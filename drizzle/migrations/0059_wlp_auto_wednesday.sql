-- WLP Auto-Wednesday: auto-create sessions on Wednesdays, restrict evening QR to Wednesday only,
-- and rewrite King/Queen to check ALL members against ALL Wednesdays in the month.

-- 1. Rewrite member_self_checkin to only route to WLP on Wednesdays (DOW=3) after 4 PM,
--    and auto-create a WLP session if none exists for today.
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

  -- Evening WLP routing: only on Wednesdays (DOW=3), from 4 PM IST.
  -- Auto-create a session if none exists for today.
  IF EXTRACT(DOW FROM v_today) = 3 AND v_now_ist >= time '16:00' THEN
    SELECT id INTO v_wlp_session_id FROM wlp_sessions
    WHERE session_date = v_today
    ORDER BY created_at DESC LIMIT 1;

    IF v_wlp_session_id IS NULL THEN
      INSERT INTO wlp_sessions (title, session_date, notes)
      VALUES ('WLP Session', v_today, 'Auto-created for Wednesday evening')
      ON CONFLICT ON CONSTRAINT wlp_sessions_one_per_date DO NOTHING
      RETURNING id INTO v_wlp_session_id;

      IF v_wlp_session_id IS NULL THEN
        SELECT id INTO v_wlp_session_id FROM wlp_sessions
        WHERE session_date = v_today LIMIT 1;
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

-- 2. Rewrite calc_monthly_rewards: King/Queen now checks ALL members (not just coaches),
--    counts from wlp_checkins joined with wlp_sessions on Wednesdays,
--    and requires attendance on ALL Wednesdays in the month.
CREATE OR REPLACE FUNCTION public.calc_monthly_rewards(p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_month_start date;
  v_month_end date;
  v_attendance integer;
  v_wlp integer;
  v_total_wednesdays integer;
  v_family_day uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;

  v_month_start := (p_month || '-01')::date;
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- Count total Wednesdays in the month
  SELECT count(*) INTO v_total_wednesdays
  FROM generate_series(v_month_start, v_month_end, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) = 3;

  SELECT id INTO v_family_day FROM public.wellness_events
   WHERE event_type = 'family_day' AND month = p_month LIMIT 1;

  FOR r IN SELECT id, gender, tags FROM public.wellness_members
            WHERE status IN ('active_member','renewal_due')
  LOOP
    -- Consistency 26 (unchanged)
    SELECT count(DISTINCT visit_date) INTO v_attendance
      FROM public.wellness_attendance
     WHERE member_id = r.id AND visit_date BETWEEN v_month_start AND v_month_end;

    IF v_attendance >= 26 THEN
      INSERT INTO public.wellness_monthly_rewards(member_id, month, reward_type, event_id, details)
      VALUES (r.id, p_month, 'consistency_26', v_family_day,
              jsonb_build_object('attendance_days', v_attendance))
      ON CONFLICT (member_id, month, reward_type)
      DO UPDATE SET details = jsonb_build_object('attendance_days', v_attendance),
                    event_id = EXCLUDED.event_id;
    ELSE
      DELETE FROM public.wellness_monthly_rewards
       WHERE member_id = r.id AND month = p_month AND reward_type = 'consistency_26';
    END IF;

    -- WLP King/Queen: count from wlp_checkins on Wednesday sessions, require ALL Wednesdays
    SELECT count(DISTINCT s.session_date) INTO v_wlp
    FROM public.wlp_checkins c
    JOIN public.wlp_sessions s ON s.id = c.session_id
    WHERE c.member_id = r.id
      AND s.session_date BETWEEN v_month_start AND v_month_end
      AND EXTRACT(DOW FROM s.session_date) = 3;

    IF v_total_wednesdays > 0 AND v_wlp >= v_total_wednesdays THEN
      INSERT INTO public.wellness_monthly_rewards(member_id, month, reward_type, details)
      VALUES (r.id, p_month,
              CASE WHEN lower(COALESCE(r.gender,'')) = 'male' THEN 'wlp_king' ELSE 'wlp_queen' END,
              jsonb_build_object('wlp_sessions', v_wlp, 'total_wednesdays', v_total_wednesdays))
      ON CONFLICT (member_id, month, reward_type)
      DO UPDATE SET details = jsonb_build_object('wlp_sessions', v_wlp, 'total_wednesdays', v_total_wednesdays);
    ELSE
      DELETE FROM public.wellness_monthly_rewards
       WHERE member_id = r.id AND month = p_month AND reward_type IN ('wlp_king','wlp_queen');
    END IF;
  END LOOP;
END;
$$;
