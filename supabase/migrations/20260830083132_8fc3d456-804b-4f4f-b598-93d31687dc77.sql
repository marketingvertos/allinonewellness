-- Activate the next queued membership when the active one is done
CREATE OR REPLACE FUNCTION public.activate_next_membership(p_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_active record;
  v_next record;
  v_plan record;
BEGIN
  SELECT * INTO v_active FROM wellness_memberships
   WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
   ORDER BY end_date LIMIT 1;

  IF FOUND AND v_active.remaining_servings > 0 AND v_active.end_date >= v_today THEN
    RETURN v_active.id;
  END IF;

  SELECT * INTO v_next FROM wellness_memberships
   WHERE member_id = p_member_id AND status = 'queued'
   ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_active.id IS NOT NULL THEN
    UPDATE wellness_memberships SET status = 'expired' WHERE id = v_active.id;
  END IF;

  SELECT * INTO v_plan FROM wellness_plans WHERE id = v_next.plan_id;

  UPDATE wellness_memberships
     SET status = 'active',
         start_date = v_today,
         end_date = (v_today + COALESCE(v_plan.duration_days, 30))::date
   WHERE id = v_next.id;

  UPDATE wellness_members SET status = 'active_member' WHERE id = p_member_id;

  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (p_member_id, 'membership_activated', 'whatsapp');

  RETURN v_next.id;
END; $$;

REVOKE ALL ON FUNCTION public.activate_next_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_next_membership(uuid) TO authenticated, service_role;

-- Check-in falls through to the queued plan
CREATE OR REPLACE FUNCTION public.checkin_member(p_member_id uuid, p_method checkin_method DEFAULT 'staff_entry'::checkin_method)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membership record;
  v_trial record;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_attendance_id uuid;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized to check in this member.';
  END IF;

  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = p_member_id AND visit_date = v_today) THEN
    RETURN jsonb_build_object('status','duplicate','message','Already checked in today.');
  END IF;

  SELECT * INTO v_trial FROM wellness_trials
  WHERE member_id = p_member_id AND status = 'active' AND end_date >= v_today LIMIT 1;
  IF FOUND THEN
    INSERT INTO wellness_attendance(member_id, trial_id, checkin_method, serving_deducted, staff_id)
    VALUES (p_member_id, v_trial.id, p_method, false, auth.uid());
    RETURN jsonb_build_object('status','ok','mode','trial');
  END IF;

  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
  ORDER BY end_date LIMIT 1;

  IF NOT FOUND OR v_membership.remaining_servings <= 0 OR v_membership.end_date < v_today THEN
    PERFORM public.activate_next_membership(p_member_id);
    SELECT * INTO v_membership FROM wellness_memberships
    WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
    ORDER BY end_date LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_active_plan','message','No active trial or membership.');
  END IF;
  IF v_membership.remaining_servings <= 0 THEN
    RETURN jsonb_build_object('status','exhausted','message','Serving balance exhausted. Please renew.');
  END IF;

  INSERT INTO wellness_attendance(member_id, membership_id, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id)
  VALUES (p_member_id, v_membership.id, p_method, true, v_membership.remaining_servings - 1, auth.uid())
  RETURNING id INTO v_attendance_id;

  UPDATE wellness_memberships
  SET used_servings = used_servings + 1, remaining_servings = remaining_servings - 1
  WHERE id = v_membership.id;

  INSERT INTO serving_transactions(member_id, membership_id, attendance_id, txn_type, change, balance_after, created_by)
  VALUES (p_member_id, v_membership.id, v_attendance_id, 'daily_deduction', -1, v_membership.remaining_servings - 1, COALESCE(auth.uid(), v_membership.created_by));

  RETURN jsonb_build_object('status','ok','mode','membership','remaining', v_membership.remaining_servings - 1);
END; $$;

-- Renewal with queue / extend / replace
CREATE OR REPLACE FUNCTION public.renew_membership_v2(
  p_membership_id uuid,
  p_plan_id uuid,
  p_servings integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_mode text DEFAULT 'queue',
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old record; v_plan record; v_servings integer; v_new_id uuid; v_code text;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF p_mode NOT IN ('queue','extend','replace') THEN RAISE EXCEPTION 'Invalid renewal mode.'; END IF;

  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = COALESCE(p_plan_id, v_old.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_servings := GREATEST(COALESCE(p_servings, v_plan.total_servings), 0);

  IF p_mode = 'extend' THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_servings,
           remaining_servings = remaining_servings + v_servings,
           end_date = (GREATEST(end_date, v_today) + v_plan.duration_days)::date,
           status = 'active'
     WHERE id = p_membership_id
     RETURNING id INTO v_new_id;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    SELECT member_id, id, 'renewal_allocation', v_servings, remaining_servings, auth.uid(), COALESCE(p_note,'Added to current plan')
      FROM wellness_memberships WHERE id = p_membership_id;
  ELSE
    v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

    IF p_mode = 'replace' THEN
      UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;

      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by)
      VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid())
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by)
      VALUES (v_old.member_id, v_plan.id, v_code, (GREATEST(v_old.end_date, v_today) + 1)::date,
        (GREATEST(v_old.end_date, v_today) + 1 + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'queued', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid())
      RETURNING id INTO v_new_id;
    END IF;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'renewal_allocation', v_servings, v_servings, auth.uid(),
      COALESCE(p_note, CASE WHEN p_mode = 'queue' THEN 'Queued renewal' ELSE 'Renewal (replaced current plan)' END));
  END IF;

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_old.member_id, 'membership_renewed', 'whatsapp');

  IF p_mode = 'queue' THEN
    PERFORM public.activate_next_membership(v_old.member_id);
  END IF;

  RETURN v_new_id;
END; $$;

REVOKE ALL ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text) TO authenticated, service_role;

-- Switch an active member onto a different plan
CREATE OR REPLACE FUNCTION public.switch_membership_plan(
  p_membership_id uuid,
  p_new_plan_id uuid,
  p_carry_servings boolean DEFAULT true,
  p_price numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old record; v_plan record; v_new_id uuid; v_code text; v_total integer;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_new_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_total := v_plan.total_servings + CASE WHEN p_carry_servings THEN GREATEST(v_old.remaining_servings,0) ELSE 0 END;
  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

  IF p_carry_servings THEN
    UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;
  ELSIF v_old.remaining_servings > 0 THEN
    UPDATE wellness_memberships SET status = 'queued' WHERE id = p_membership_id;
  ELSE
    UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;
  END IF;

  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by)
  VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
    v_total, 0, v_total, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_new_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_old.member_id, v_new_id, 'membership_allocation', v_total, v_total, auth.uid(),
    CASE WHEN p_carry_servings THEN 'Plan switched (carried leftover servings)' ELSE 'Plan switched (previous balance queued)' END);

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  RETURN v_new_id;
END; $$;

REVOKE ALL ON FUNCTION public.switch_membership_plan(uuid, uuid, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_membership_plan(uuid, uuid, boolean, numeric) TO authenticated, service_role;

-- Status refresh must not touch queued plans
CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;
  UPDATE wellness_memberships SET status = 'expired' WHERE status IN ('active','expiring_soon') AND end_date < v_today;
  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND (end_date - v_today) <= 5 AND end_date >= v_today;
  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));
  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END; $$;

-- Achievements follow the member category
CREATE OR REPLACE FUNCTION public.recalc_member_achievements(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member record;
  v_referrals integer;
  v_start numeric;
  v_current numeric;
  v_delta numeric;
  v_direction text;
  v_category text;
BEGIN
  SELECT * INTO v_member FROM public.wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_referrals FROM public.wellness_members
   WHERE referred_by_member_id = p_member_id AND status <> 'inactive';

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = 'referral' AND d.is_active AND v_referrals >= d.threshold
  ON CONFLICT DO NOTHING;

  v_start := COALESCE(v_member.initial_weight,
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date ASC, w.created_at ASC LIMIT 1));
  v_current := COALESCE(
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date DESC, w.created_at DESC LIMIT 1),
    v_member.current_weight);

  IF v_start IS NULL OR v_current IS NULL THEN RETURN; END IF;

  SELECT c.direction INTO v_direction FROM public.member_categories c WHERE c.id = v_member.category_id;
  IF v_direction IS NULL THEN
    v_direction := CASE WHEN v_member.goal = 'weight_gain' THEN 'gain' ELSE 'loss' END;
  END IF;

  IF v_direction = 'gain' THEN
    v_category := 'weight_gain';
    v_delta := v_current - v_start;
  ELSE
    v_category := 'weight_loss';
    v_delta := v_start - v_current;
  END IF;

  IF v_delta <= 0 THEN RETURN; END IF;

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = v_category AND d.is_active AND v_delta >= d.threshold
  ON CONFLICT DO NOTHING;
END; $$;
