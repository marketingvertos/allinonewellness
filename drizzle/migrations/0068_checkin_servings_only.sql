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