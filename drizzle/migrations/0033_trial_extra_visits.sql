CREATE OR REPLACE FUNCTION public.mark_trial_attendance(p_trial_id uuid, p_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  v_is_extra := v_used >= v_total OR v_date > COALESCE(v_trial.end_date, v_trial.start_date + v_total - 1);
  INSERT INTO wellness_attendance(member_id, trial_id, visit_date, visit_time, checkin_method, serving_deducted, staff_id, is_trial_advance)
  VALUES (v_trial.member_id, p_trial_id, v_date,
          ((v_date + (now() AT TIME ZONE 'Asia/Kolkata')::time) AT TIME ZONE 'Asia/Kolkata'),
          'staff_entry', false, auth.uid(), v_is_extra);
  IF v_is_extra THEN v_extra := v_extra + 1; ELSE v_used := v_used + 1; END IF;
  RETURN jsonb_build_object('status','ok','extra', v_is_extra, 'used', v_used, 'total', v_total, 'extra_count', v_extra);
END $$;
REVOKE ALL ON FUNCTION public.mark_trial_attendance(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_trial_attendance(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_trial_advance_deduction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; v_bal integer;
BEGIN
  FOR r IN SELECT id, visit_date FROM wellness_attendance
           WHERE member_id = NEW.member_id AND is_trial_advance AND membership_id IS NULL AND NOT serving_deducted
           ORDER BY visit_date LOOP
    UPDATE wellness_memberships
      SET used_servings = used_servings + 1, remaining_servings = GREATEST(remaining_servings - 1, 0)
      WHERE id = NEW.id RETURNING remaining_servings INTO v_bal;
    UPDATE wellness_attendance SET membership_id = NEW.id, serving_deducted = true, remaining_balance_snapshot = v_bal WHERE id = r.id;
    INSERT INTO serving_transactions(member_id, membership_id, attendance_id, txn_type, change, balance_after, created_by, note)
    VALUES (NEW.member_id, NEW.id, r.id, 'trial_advance_deduction', -1, v_bal, COALESCE(auth.uid(), NEW.created_by),
            'Extra trial visit on ' || to_char(r.visit_date, 'DD/MM/YYYY'));
  END LOOP;
  RETURN NULL;
END $function$;