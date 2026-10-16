CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text, p_weight numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_member_id uuid;
  v_valid boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_now_ist time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
  v_membership record;
  v_has_trial boolean;
  v_request public.wellness_checkin_requests;
  v_wlp_session_id uuid;
  v_wlp_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM wellness_centre_settings WHERE checkin_code = p_code) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('status','invalid_code','message','This QR code is no longer valid. Please ask the front desk.');
  END IF;

  SELECT * INTO v_member FROM wellness_members WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_member','message','No member profile is linked to this login.');
  END IF;
  v_member_id := v_member.id;

  -- Evening routing: from 4 PM IST, scans go to today's WLP session when one exists.
  IF v_now_ist >= time '16:00' THEN
    SELECT id INTO v_wlp_session_id FROM wlp_sessions
    WHERE session_date = v_today
    ORDER BY created_at DESC LIMIT 1;
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

  SELECT EXISTS (
    SELECT 1 FROM wellness_trials
    WHERE member_id = v_member_id AND status = 'active' AND end_date >= v_today
  ) INTO v_has_trial;

  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND end_date >= v_today
  ORDER BY end_date LIMIT 1;

  IF NOT v_has_trial AND v_membership.id IS NULL AND public.trial_advance_eligible(v_member_id) IS NOT NULL THEN
    INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
    VALUES (v_member_id, NULL, v_today, p_weight)
    RETURNING * INTO v_request;
    RETURN jsonb_build_object('status','pending','mode','trial_advance','request_id', v_request.id,
      'message','Welcome back! Your 1-day trial was completed. Today''s session is on us as a courtesy. Please activate your membership to continue.');
  END IF;

  IF NOT v_has_trial THEN
    IF v_membership.id IS NULL THEN
      PERFORM public.activate_next_membership(v_member_id);
      SELECT * INTO v_membership FROM wellness_memberships
      WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND end_date >= v_today
      ORDER BY end_date LIMIT 1;
    END IF;

    IF v_membership.id IS NULL THEN
      IF COALESCE(v_member.is_guest, false) THEN
        RETURN jsonb_build_object('status','trial_ended','message','Your free guest trial has ended. Please take a membership — contact your coach.');
      END IF;
      RETURN jsonb_build_object('status','renew_required','message','Your membership has ended. Please renew — contact your coach.');
    END IF;

    IF v_membership.remaining_servings <= 0 THEN
      RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
    END IF;
  END IF;

  INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
  VALUES (v_member_id, v_membership.id, v_today, p_weight)
  RETURNING * INTO v_request;

  RETURN jsonb_build_object('status','pending','request_id', v_request.id,
    'message','Your check-in request has been sent for approval.');
END;
$$;