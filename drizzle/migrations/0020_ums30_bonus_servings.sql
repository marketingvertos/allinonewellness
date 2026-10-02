CREATE OR REPLACE FUNCTION public.plan_gets_bonus(p_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM wellness_plans WHERE id = p_plan_id AND plan_type = 'membership' AND total_servings = 30)
$$;

CREATE OR REPLACE FUNCTION public.apply_joining_bonus(p_membership_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m record; v_balance integer;
BEGIN
  SELECT * INTO v_m FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND OR v_m.renewed_from IS NOT NULL OR NOT public.plan_gets_bonus(v_m.plan_id) THEN RETURN; END IF;
  UPDATE wellness_memberships SET total_servings = total_servings + 2, remaining_servings = remaining_servings + 2
   WHERE id = p_membership_id RETURNING remaining_servings INTO v_balance;
  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_m.member_id, p_membership_id, 'manual_adjustment', 2, v_balance, COALESCE(auth.uid(), v_m.created_by), 'Joining bonus (+2 servings)');
END; $$;
REVOKE EXECUTE ON FUNCTION public.apply_joining_bonus(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_membership(p_member_id uuid, p_plan_id uuid, p_price numeric DEFAULT NULL::numeric)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan record; v_membership_id uuid; v_code text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;
  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');
  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, price_paid, created_by)
  VALUES (p_member_id, p_plan_id, v_code, current_date, (current_date + v_plan.duration_days)::date,
    v_plan.total_servings, 0, v_plan.total_servings, 'active', COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_membership_id;
  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by)
  VALUES (p_member_id, v_membership_id, 'membership_allocation', v_plan.total_servings, v_plan.total_servings, auth.uid());
  PERFORM public.apply_joining_bonus(v_membership_id);
  UPDATE wellness_members SET status = 'active_member' WHERE id = p_member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (p_member_id, 'membership_activated', 'whatsapp');
  RETURN v_membership_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.convert_trial_to_membership(p_trial_id uuid, p_plan_id uuid, p_price numeric DEFAULT NULL::numeric)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_trial record; v_plan record; v_membership_id uuid; v_code text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_trial FROM wellness_trials WHERE id = p_trial_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;
  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');
  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, price_paid, created_by)
  VALUES (v_trial.member_id, p_plan_id, v_code, current_date, (current_date + v_plan.duration_days)::date,
    v_plan.total_servings, 0, v_plan.total_servings, 'active', COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_membership_id;
  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_trial.member_id, v_membership_id, 'membership_allocation', v_plan.total_servings, v_plan.total_servings, auth.uid(), 'Converted from trial');
  PERFORM public.apply_joining_bonus(v_membership_id);
  UPDATE wellness_trials SET status = 'converted' WHERE id = p_trial_id;
  UPDATE wellness_members SET status = 'active_member' WHERE id = v_trial.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_trial.member_id, 'membership_activated', 'whatsapp');
  RETURN v_membership_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.renew_membership_v2(p_membership_id uuid, p_plan_id uuid, p_servings integer DEFAULT NULL::integer, p_price numeric DEFAULT NULL::numeric, p_mode text DEFAULT 'queue'::text, p_note text DEFAULT NULL::text, p_payment_mode text DEFAULT 'cash'::text, p_payment_date date DEFAULT NULL::date)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_old record; v_plan record; v_servings integer; v_new_id uuid; v_code text;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_pay_date date; v_is_early boolean; v_bonus integer := 2; v_balance integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF p_mode NOT IN ('queue','extend','replace') THEN RAISE EXCEPTION 'Invalid renewal mode.'; END IF;
  v_pay_date := COALESCE(p_payment_date, v_today);
  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = COALESCE(p_plan_id, v_old.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;
  v_servings := GREATEST(COALESCE(p_servings, v_plan.total_servings), 0);
  v_is_early := (v_today <= v_old.end_date);

  IF p_mode = 'extend' THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_servings,
           remaining_servings = remaining_servings + v_servings,
           end_date = (GREATEST(end_date, v_today) + v_plan.duration_days)::date,
           status = 'active', payment_mode = COALESCE(p_payment_mode, 'cash'), payment_date = v_pay_date
     WHERE id = p_membership_id RETURNING id INTO v_new_id;
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    SELECT member_id, id, 'renewal_allocation', v_servings, remaining_servings, auth.uid(), COALESCE(p_note,'Added to current plan')
      FROM wellness_memberships WHERE id = p_membership_id;
  ELSE
    v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');
    IF p_mode = 'replace' THEN
      UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;
      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by, payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by, payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, (GREATEST(v_old.end_date, v_today) + 1)::date,
        (GREATEST(v_old.end_date, v_today) + 1 + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'queued', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    END IF;
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'renewal_allocation', v_servings, v_servings, auth.uid(),
      COALESCE(p_note, CASE WHEN p_mode = 'queue' THEN 'Queued renewal' ELSE 'Renewal (replaced current plan)' END));
  END IF;

  -- Early-renewal bonus: only 30-serving membership plans.
  IF v_is_early AND v_servings > 0 AND public.plan_gets_bonus(v_plan.id) THEN
    UPDATE wellness_memberships SET total_servings = total_servings + v_bonus, remaining_servings = remaining_servings + v_bonus
     WHERE id = v_new_id RETURNING remaining_servings INTO v_balance;
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'manual_adjustment', v_bonus, v_balance, auth.uid(), 'Early renewal bonus (+2 servings)');
    INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
    VALUES (v_old.member_id, 'early_renewal_bonus', 'whatsapp');
  END IF;

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_old.member_id, 'membership_renewed', 'whatsapp');
  IF p_mode = 'queue' THEN PERFORM public.activate_next_membership(v_old.member_id); END IF;
  RETURN v_new_id;
END;
$function$;