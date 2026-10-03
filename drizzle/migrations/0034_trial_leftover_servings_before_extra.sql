CREATE OR REPLACE FUNCTION public.mark_trial_attendance(p_trial_id uuid, p_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_trial record;
  v_used int;
  v_extra int;
  v_total int;
  v_is_extra boolean;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can mark trial attendance.'; END IF;
  SELECT * INTO v_trial FROM wellness_trials WHERE id = p_trial_id;
  IF NOT FOUND OR v_trial.status IN ('converted','cancelled') THEN
    RETURN jsonb_build_object('status','error','message','This trial is closed.');
  END IF;
  IF EXISTS (SELECT 1 FROM wellness_memberships WHERE member_id = v_trial.member_id AND status IN ('active','expiring_soon','queued')) THEN
    RETURN jsonb_build_object('status','error','message','This person already has a membership — use the normal check-in.');
  END IF;
  v_total := GREATEST(COALESCE(v_trial.duration_days,1),1);
  IF v_date > v_today THEN RETURN jsonb_build_object('status','error','message','You cannot mark a future date.'); END IF;
  IF v_date < v_trial.start_date THEN RETURN jsonb_build_object('status','error','message','This date is before the trial started.'); END IF;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_trial.member_id AND visit_date = v_date) THEN
    RETURN jsonb_build_object('status','duplicate','message','Already marked for this day.');
  END IF;
  SELECT count(*) FILTER (WHERE NOT is_trial_advance), count(*) FILTER (WHERE is_trial_advance)
    INTO v_used, v_extra FROM wellness_attendance WHERE trial_id = p_trial_id;
  -- Leftover trial servings stay usable after the end date; extra visits begin only once all servings are used.
  v_is_extra := v_used >= v_total;
  INSERT INTO wellness_attendance(member_id, trial_id, visit_date, visit_time, checkin_method, serving_deducted, staff_id, is_trial_advance)
  VALUES (v_trial.member_id, p_trial_id, v_date,
          ((v_date + (now() AT TIME ZONE 'Asia/Kolkata')::time) AT TIME ZONE 'Asia/Kolkata'),
          'staff_entry', false, auth.uid(), v_is_extra);
  IF v_is_extra THEN v_extra := v_extra + 1; ELSE v_used := v_used + 1; END IF;
  RETURN jsonb_build_object('status','ok','extra', v_is_extra, 'used', v_used, 'total', v_total, 'extra_count', v_extra);
END $function$;