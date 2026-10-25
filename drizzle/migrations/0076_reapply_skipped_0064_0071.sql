-- Re-applies migrations 0064, 0067, 0068, 0069, 0070 and 0071 (except its older miw_report), which were skipped by the migrator.
CREATE OR REPLACE FUNCTION public.miw_fulfil_payment(p_order_id uuid,p_payment_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record; p uuid;
BEGIN
 IF NOT public.is_payment_service() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_payment_id IS NULL OR p_payment_id !~ '^pay_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Invalid payment identifier'; END IF;
 SELECT * INTO o FROM razorpay_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.context<>'miw' OR o.miw_challenge_id IS NULL THEN RAISE EXCEPTION 'MIW order not found'; END IF;
 IF o.status='paid' THEN
  IF o.razorpay_payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'Payment identifier mismatch'; END IF;
  RETURN jsonb_build_object('status','already_paid');
 END IF;
 IF o.status NOT IN ('created','failed') THEN RAISE EXCEPTION 'Order cannot be fulfilled'; END IF;
 IF EXISTS(SELECT 1 FROM razorpay_orders WHERE id<>o.id AND razorpay_payment_id=p_payment_id) THEN RAISE EXCEPTION 'Payment already used'; END IF;
 PERFORM 1 FROM wellness_members WHERE id=o.member_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM miw_participants WHERE challenge_id=o.miw_challenge_id AND member_id=o.member_id) THEN RAISE EXCEPTION 'Already registered; contact staff to reconcile payment'; END IF;
 INSERT INTO miw_participants(challenge_id,member_id,source) VALUES(o.miw_challenge_id,o.member_id,'online') RETURNING id INTO p;
 INSERT INTO miw_payments(participant_id,member_id,amount,mode,reference) VALUES(p,o.member_id,o.amount_paise::numeric/100,'online',p_payment_id);
 UPDATE wellness_members SET tags=array_append(array_remove(tags,'miw'),'miw') WHERE id=o.member_id;
 UPDATE razorpay_orders SET status='paid',razorpay_payment_id=p_payment_id,updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('status','paid','participant_id',p);
END $$;
REVOKE ALL ON FUNCTION public.miw_fulfil_payment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.miw_fulfil_payment(uuid,text) TO service_role;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.get_club_daily_report(text)'::regprocedure) INTO definition;
 IF position('miw_payments' in definition)=0 THEN
  definition:=replace(definition,'mode, amount FROM wellness_payments','mode, amount FROM wellness_payments UNION ALL SELECT (paid_at AT TIME ZONE ''Asia/Kolkata'')::date AS d, mode, amount FROM miw_payments');
  EXECUTE definition;
 END IF;
 SELECT pg_get_functiondef('public.get_club_monthly_report(text)'::regprocedure) INTO definition;
 IF position('miw_payments' in definition)=0 THEN
  definition:=replace(definition,'SELECT sum(amount) FROM wellness_payments WHERE','SELECT sum(amount) FROM (SELECT amount,paid_at FROM wellness_payments UNION ALL SELECT amount,paid_at FROM miw_payments) combined_payments WHERE');
  EXECUTE definition;
 END IF;
END $$;
ALTER TABLE public.miw_participants ADD COLUMN IF NOT EXISTS removed_at timestamptz, ADD COLUMN IF NOT EXISTS removed_by uuid, ADD COLUMN IF NOT EXISTS removed_reason text;
ALTER TABLE public.miw_payments ADD COLUMN IF NOT EXISTS voided_at timestamptz, ADD COLUMN IF NOT EXISTS void_reason text;

CREATE OR REPLACE FUNCTION public.miw_remove_participant(p_participant_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_member uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can remove MIW participants'; END IF;
  UPDATE miw_participants SET removed_at=now(), removed_by=auth.uid(), removed_reason=NULLIF(trim(p_reason),'')
   WHERE id=p_participant_id AND removed_at IS NULL RETURNING member_id INTO v_member;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Participant not found or already removed'; END IF;
  UPDATE miw_payments SET voided_at=now(), void_reason=COALESCE(NULLIF(trim(p_reason),''),'Removed from challenge')
   WHERE participant_id=p_participant_id AND voided_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM miw_participants WHERE member_id=v_member AND removed_at IS NULL) THEN
    UPDATE wellness_members SET tags=array_remove(tags,'miw') WHERE id=v_member;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.miw_remove_participant(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.miw_remove_participant(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.miw_report(p_challenge_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c record; rows jsonb;
BEGIN
 SELECT * INTO c FROM miw_challenges WHERE id=p_challenge_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
 WITH readings AS (
 SELECT member_id,recorded_date,weight,created_at FROM weight_tracking
 UNION ALL SELECT member_id,recorded_date,weight,created_at FROM body_measurements WHERE weight IS NOT NULL
 ), people AS (
 SELECT p.id participant_id,p.member_id,m.full_name member_name,m.mobile_number mobile,p.source,p.joined_at,
 (SELECT weight FROM readings w WHERE w.member_id=p.member_id AND recorded_date<=c.start_date ORDER BY recorded_date DESC,created_at DESC LIMIT 1) start_weight,
 (SELECT weight FROM readings w WHERE w.member_id=p.member_id AND recorded_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date) ORDER BY recorded_date DESC,created_at DESC LIMIT 1) latest_weight,
 (SELECT count(*) FROM wellness_attendance a WHERE a.member_id=p.member_id AND a.checkin_method<>'serving_issue' AND visit_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) visits,
 (SELECT count(DISTINCT visit_date) FROM wellness_attendance a WHERE a.member_id=p.member_id AND a.checkin_method<>'serving_issue' AND visit_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) days_attended,
 (SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY recorded_date,created_at),'[]') FROM readings w WHERE w.member_id=p.member_id AND recorded_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) journey
 FROM miw_participants p JOIN wellness_members m ON m.id=p.member_id WHERE challenge_id=c.id AND p.removed_at IS NULL AND (public.is_wellness_staff(auth.uid()) OR m.user_id=auth.uid())
 ) SELECT COALESCE(jsonb_agg(to_jsonb(people) ORDER BY latest_weight-start_weight NULLS LAST),'[]') INTO rows FROM people;
 RETURN jsonb_build_object('challenge',to_jsonb(c),'participants',rows,'participant_count',jsonb_array_length(rows),
 'total_paid',(SELECT COALESCE(sum(pay.amount),0) FROM miw_payments pay JOIN miw_participants p ON p.id=pay.participant_id WHERE p.challenge_id=c.id AND p.removed_at IS NULL AND pay.voided_at IS NULL AND (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(),p.member_id))));
END $function$;

CREATE OR REPLACE FUNCTION public.activate_next_membership(p_member_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_active record; v_next record; v_plan record;
BEGIN
  SELECT * INTO v_active FROM wellness_memberships
   WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
   ORDER BY (remaining_servings > 0) DESC, start_date LIMIT 1;
  IF FOUND AND v_active.remaining_servings > 0 THEN
    RETURN v_active.id;
  END IF;
  SELECT * INTO v_next FROM wellness_memberships
   WHERE member_id = p_member_id AND status = 'queued' ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_active.id IS NOT NULL THEN
    UPDATE wellness_memberships SET status = 'expired' WHERE id = v_active.id;
  END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = v_next.plan_id;
  UPDATE wellness_memberships SET status = 'active', start_date = v_today,
         end_date = (v_today + COALESCE(v_plan.duration_days, 30))::date
   WHERE id = v_next.id;
  UPDATE wellness_members SET status = 'active_member' WHERE id = p_member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (p_member_id, 'membership_activated', 'whatsapp');
  RETURN v_next.id;
END; $function$;

CREATE OR REPLACE FUNCTION public.checkin_member(p_member_id uuid, p_method checkin_method DEFAULT 'staff_entry'::checkin_method)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_membership record; v_trial record; v_member record;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_attendance_id uuid;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized to check in this member.';
  END IF;
  SELECT * INTO v_member FROM wellness_members WHERE id = p_member_id;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = p_member_id AND visit_date = v_today AND checkin_method = 'serving_issue') THEN
    RETURN jsonb_build_object('status','duplicate','message','Serving already issued (packed) for today.');
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
  IF public.trial_advance_eligible(p_member_id) IS NOT NULL THEN
    INSERT INTO wellness_attendance(member_id, trial_id, checkin_method, serving_deducted, staff_id, is_trial_advance)
    VALUES (p_member_id, public.trial_advance_eligible(p_member_id), p_method, false, auth.uid(), true);
    RETURN jsonb_build_object('status','ok','mode','trial_advance','message','Day 2 courtesy visit granted — 1 serving will be deducted when a membership is activated.');
  END IF;
  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
  ORDER BY (remaining_servings > 0) DESC, start_date LIMIT 1;
  IF NOT FOUND OR v_membership.remaining_servings <= 0 THEN
    PERFORM public.activate_next_membership(p_member_id);
    SELECT * INTO v_membership FROM wellness_memberships
    WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
    ORDER BY (remaining_servings > 0) DESC, start_date LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    IF COALESCE(v_member.is_guest, false) THEN
      RETURN jsonb_build_object('status','trial_ended','message','This free guest trial has ended. Please take a membership — contact your coach.');
    END IF;
    RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
  END IF;
  IF v_membership.remaining_servings <= 0 THEN
    RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
  END IF;
  INSERT INTO wellness_attendance(member_id, membership_id, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id)
  VALUES (p_member_id, v_membership.id, p_method, true, v_membership.remaining_servings - 1, auth.uid())
  RETURNING id INTO v_attendance_id;
  UPDATE wellness_memberships SET used_servings = used_servings + 1, remaining_servings = remaining_servings - 1
  WHERE id = v_membership.id;
  INSERT INTO serving_transactions(member_id, membership_id, attendance_id, txn_type, change, balance_after, created_by)
  VALUES (p_member_id, v_membership.id, v_attendance_id, 'daily_deduction', -1, v_membership.remaining_servings - 1, COALESCE(auth.uid(), v_membership.created_by));
  RETURN jsonb_build_object('status','ok','mode','membership','remaining', v_membership.remaining_servings - 1);
END; $function$;

CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text, p_weight numeric DEFAULT NULL::numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_member record; v_member_id uuid; v_valid boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_now_ist time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
  v_membership record; v_has_trial boolean;
  v_request public.wellness_checkin_requests;
  v_wlp_session_id uuid; v_wlp_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT EXISTS (SELECT 1 FROM wellness_centre_settings WHERE checkin_code = p_code) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('status','invalid_code','message','This QR code is no longer valid. Please ask the front desk.');
  END IF;
  SELECT * INTO v_member FROM wellness_members WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_member','message','No member profile is linked to this login.');
  END IF;
  v_member_id := v_member.id;
  IF EXTRACT(DOW FROM v_today) = 3 AND v_now_ist >= time '16:00' THEN
    SELECT id INTO v_wlp_session_id FROM wlp_sessions WHERE session_date = v_today ORDER BY created_at DESC LIMIT 1;
    IF v_wlp_session_id IS NULL THEN
      INSERT INTO wlp_sessions (title, session_date, notes)
      VALUES ('WLP Session', v_today, 'Auto-created for Wednesday evening')
      ON CONFLICT ON CONSTRAINT wlp_sessions_one_per_date DO NOTHING
      RETURNING id INTO v_wlp_session_id;
      IF v_wlp_session_id IS NULL THEN
        SELECT id INTO v_wlp_session_id FROM wlp_sessions WHERE session_date = v_today LIMIT 1;
      END IF;
    END IF;
    IF v_wlp_session_id IS NOT NULL THEN
      v_wlp_result := public.wlp_checkin_member(v_wlp_session_id, v_member_id, 'qr_scan')::jsonb;
      RETURN v_wlp_result || jsonb_build_object('mode','wlp');
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_member_id AND visit_date = v_today AND checkin_method = 'serving_issue') THEN
    RETURN jsonb_build_object('status','duplicate','message','Your serving for today was already issued (packed).');
  END IF;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_member_id AND visit_date = v_today) THEN
    RETURN jsonb_build_object('status','duplicate','message','Your visit is already recorded for today.');
  END IF;
  SELECT * INTO v_request FROM wellness_checkin_requests
  WHERE member_id = v_member_id AND request_date = v_today AND status = 'pending' LIMIT 1;
  IF FOUND THEN
    IF p_weight IS NOT NULL THEN
      UPDATE wellness_checkin_requests SET requested_weight = p_weight WHERE id = v_request.id;
    END IF;
    RETURN jsonb_build_object('status','pending','request_id', v_request.id,
      'message','Your check-in request is waiting for approval at the front desk.');
  END IF;
  SELECT EXISTS (SELECT 1 FROM wellness_trials WHERE member_id = v_member_id AND status = 'active' AND end_date >= v_today) INTO v_has_trial;
  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND remaining_servings > 0
  ORDER BY start_date LIMIT 1;
  IF NOT v_has_trial AND v_membership.id IS NULL AND public.trial_advance_eligible(v_member_id) IS NOT NULL THEN
    INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
    VALUES (v_member_id, NULL, v_today, p_weight) RETURNING * INTO v_request;
    RETURN jsonb_build_object('status','pending','mode','trial_advance','request_id', v_request.id,
      'message','Welcome back! Your 1-day trial was completed. Today''s session is on us as a courtesy. Please activate your membership to continue.');
  END IF;
  IF NOT v_has_trial THEN
    IF v_membership.id IS NULL THEN
      PERFORM public.activate_next_membership(v_member_id);
      SELECT * INTO v_membership FROM wellness_memberships
      WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND remaining_servings > 0
      ORDER BY start_date LIMIT 1;
    END IF;
    IF v_membership.id IS NULL THEN
      IF COALESCE(v_member.is_guest, false) THEN
        RETURN jsonb_build_object('status','trial_ended','message','Your free guest trial has ended. Please take a membership — contact your coach.');
      END IF;
      RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
    END IF;
  END IF;
  INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
  VALUES (v_member_id, v_membership.id, v_today, p_weight) RETURNING * INTO v_request;
  RETURN jsonb_build_object('status','pending','request_id', v_request.id,
    'message','Your check-in request has been sent for approval.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_membership_plan_sync_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    UPDATE public.wellness_payments SET plan_id = NEW.plan_id
     WHERE membership_id = NEW.id AND context = 'renewal' AND plan_id = OLD.plan_id
       AND paid_at >= COALESCE(NEW.updated_at, now()) - interval '1 day';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS membership_plan_sync_payments ON public.wellness_memberships;
CREATE TRIGGER membership_plan_sync_payments AFTER UPDATE OF plan_id ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_membership_plan_sync_payments();
UPDATE public.wellness_payments p SET plan_id = m.plan_id
FROM public.wellness_memberships m, public.wellness_plans np, public.wellness_plans mp
WHERE p.membership_id = m.id AND p.context = 'renewal' AND np.id = p.plan_id AND mp.id = m.plan_id
  AND p.plan_id <> m.plan_id AND np.name ILIKE '%new%' AND mp.name ILIKE '%renew%';

CREATE OR REPLACE FUNCTION public.convert_guest_to_paid_trial(p_trial_id uuid, p_plan_id uuid, p_payment_mode text DEFAULT 'cash'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_t record; v_plan record; v_new uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_t FROM wellness_trials WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  IF v_t.status IN ('converted','cancelled') THEN RAISE EXCEPTION 'This trial has already been converted.'; END IF;
  IF v_t.plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM wellness_plans WHERE id = v_t.plan_id AND plan_type = 'trial' AND price > 0) THEN
    RAISE EXCEPTION 'This member is already on a paid trial. Convert to a membership, or use Change trial.';
  END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id AND plan_type = 'trial' AND price > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paid trial plan not found.'; END IF;
  UPDATE wellness_trials SET status = 'converted' WHERE id = p_trial_id;
  INSERT INTO wellness_trials(member_id, plan_id, start_date, duration_days, weight_at_start, status, created_by)
  VALUES (v_t.member_id, p_plan_id, current_date, v_plan.duration_days, v_t.weight_at_start, 'active', auth.uid())
  RETURNING id INTO v_new;
  UPDATE wellness_members SET status = 'trial' WHERE id = v_t.member_id;
  INSERT INTO member_notes(member_id, note, created_by)
  VALUES (v_t.member_id, 'Guest trial converted to ' || v_plan.name || ' (₹' || v_plan.price::int || ', ' || COALESCE(p_payment_mode,'cash') || ')', auth.uid());
  RETURN v_new;
END; $function$;

DO $do$
DECLARE fn_body text;
BEGIN
  SELECT prosrc INTO fn_body FROM pg_proc
  WHERE proname = 'refresh_wellness_statuses'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  IF fn_body IS NOT NULL AND fn_body LIKE '%servings_exhausted_on < v_today - 10%' THEN
    fn_body := replace(fn_body, 'servings_exhausted_on < v_today - 10', 'servings_exhausted_on <= v_today - 10');
    EXECUTE format('CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'' AS $f$%s$f$', fn_body);
  END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT public.is_wellness_staff(auth.uid()) THEN
    IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.initial_weight IS DISTINCT FROM OLD.initial_weight
      OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.tags IS DISTINCT FROM OLD.tags THEN
      RAISE EXCEPTION 'You can only update your own basic profile details.';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_supervisor_status(p_member_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month text; v_sup boolean; v_self boolean; v_new_fl integer;
  v_fl integer; v_tot integer; v_level integer;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  v_month := public.ist_month();
  SELECT 'supervisor' = ANY(tags), frontline_count, network_total, master_level
    INTO v_sup, v_fl, v_tot, v_level
  FROM public.wellness_members WHERE id = p_member_id;
  v_self := public.member_active_in_month(p_member_id, v_month);
  v_new_fl := public.supervisor_new_frontline(p_member_id, v_month);
  RETURN jsonb_build_object(
    'month', v_month,
    'is_supervisor', COALESCE(v_sup, false),
    'self_renewed', COALESCE(v_self, false),
    'new_frontline_count', COALESCE(v_new_fl, 0),
    'new_frontline_required', 2,
    'qualifying_frontline', COALESCE(v_fl, 0),
    'qualifying_network_total', COALESCE(v_tot, 0),
    'master_level', COALESCE(v_level, 0),
    'is_qualified', COALESCE(v_sup, false) AND COALESCE(v_self, false) AND COALESCE(v_new_fl, 0) >= 2
  );
END;
$function$;