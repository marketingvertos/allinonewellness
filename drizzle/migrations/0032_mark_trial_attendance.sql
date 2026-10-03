CREATE OR REPLACE FUNCTION public.mark_trial_attendance(p_trial_id uuid, p_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_trial record;
  v_used int;
  v_total int;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can mark trial attendance.'; END IF;
  SELECT * INTO v_trial FROM wellness_trials WHERE id = p_trial_id;
  IF NOT FOUND OR v_trial.status NOT IN ('active') THEN
    RETURN jsonb_build_object('status','error','message','This trial is not active.');
  END IF;
  v_total := GREATEST(COALESCE(v_trial.duration_days,1),1);
  IF v_date > v_today THEN RETURN jsonb_build_object('status','error','message','You cannot mark a future date.'); END IF;
  IF v_date < v_trial.start_date OR v_date > COALESCE(v_trial.end_date, v_trial.start_date + v_total - 1) THEN
    RETURN jsonb_build_object('status','error','message','This date is outside the trial period.');
  END IF;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_trial.member_id AND visit_date = v_date) THEN
    RETURN jsonb_build_object('status','duplicate','message','Already marked for this day.');
  END IF;
  SELECT count(*) INTO v_used FROM wellness_attendance WHERE trial_id = p_trial_id;
  IF v_used >= v_total THEN
    RETURN jsonb_build_object('status','error','message','All trial servings used — convert to a membership.');
  END IF;
  INSERT INTO wellness_attendance(member_id, trial_id, visit_date, visit_time, checkin_method, serving_deducted, staff_id)
  VALUES (v_trial.member_id, p_trial_id, v_date,
          ((v_date + (now() AT TIME ZONE 'Asia/Kolkata')::time) AT TIME ZONE 'Asia/Kolkata'),
          'staff_entry', false, auth.uid());
  RETURN jsonb_build_object('status','ok','used', v_used + 1, 'total', v_total);
END $$;
REVOKE ALL ON FUNCTION public.mark_trial_attendance(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_trial_attendance(uuid, date) TO authenticated, service_role;