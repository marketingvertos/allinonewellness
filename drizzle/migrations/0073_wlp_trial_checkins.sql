ALTER TABLE public.wlp_checkins ADD COLUMN IF NOT EXISTS trial_id uuid REFERENCES public.wellness_trials(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.wlp_checkin_member(p_session_id uuid, p_member_id uuid, p_method checkin_method DEFAULT 'staff_entry'::checkin_method)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session wlp_sessions; v_membership wellness_memberships; v_txn_id uuid; v_checkin_id uuid;
  v_new_remaining int; v_warning text := NULL; v_member_name text; v_actor uuid; v_trial_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_wellness_staff(auth.uid()) AND NOT owns_wellness_member(auth.uid(), p_member_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO v_session FROM wlp_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WLP session not found'; END IF;
  v_actor := coalesce(auth.uid(), v_session.created_by);
  IF EXISTS (SELECT 1 FROM wlp_checkins WHERE session_id = p_session_id AND member_id = p_member_id) THEN
    SELECT full_name INTO v_member_name FROM wellness_members WHERE id = p_member_id;
    RETURN json_build_object('status','duplicate','message', coalesce(v_member_name,'Member') || ' is already checked in to this session.');
  END IF;
  SELECT * INTO v_membership FROM wellness_memberships
   WHERE member_id = p_member_id AND status IN ('active','expiring_soon') ORDER BY end_date LIMIT 1;
  IF FOUND THEN
    IF v_membership.remaining_servings <= 0 THEN v_warning := 'overdraft'; END IF;
    v_new_remaining := v_membership.remaining_servings - 1;
    UPDATE wellness_memberships SET used_servings = used_servings + 1, remaining_servings = remaining_servings - 1, updated_at = now()
     WHERE id = v_membership.id;
    INSERT INTO serving_transactions (member_id, membership_id, txn_type, change, balance_after, note, created_by)
    VALUES (p_member_id, v_membership.id, 'wlp_deduction', -1, v_new_remaining,
            'WLP session: ' || v_session.title || ' (' || v_session.session_date || ')', v_actor)
    RETURNING id INTO v_txn_id;
    INSERT INTO wlp_checkins (session_id, member_id, membership_id, serving_deducted, serving_txn_id, checkin_method, created_by)
    VALUES (p_session_id, p_member_id, v_membership.id, true, v_txn_id, p_method, v_actor)
    RETURNING id INTO v_checkin_id;
  ELSE
    SELECT id INTO v_trial_id FROM wellness_trials
     WHERE member_id = p_member_id AND status NOT IN ('converted','cancelled')
     ORDER BY start_date DESC LIMIT 1;
    v_warning := CASE WHEN v_trial_id IS NOT NULL THEN 'trial' ELSE 'no_membership' END;
    INSERT INTO wlp_checkins (session_id, member_id, serving_deducted, checkin_method, created_by, trial_id)
    VALUES (p_session_id, p_member_id, false, p_method, v_actor, v_trial_id)
    RETURNING id INTO v_checkin_id;
  END IF;
  INSERT INTO wellness_wlp_attendance (member_id, session_date, month, marked_by)
  VALUES (p_member_id, v_session.session_date, to_char(v_session.session_date,'YYYY-MM'), v_actor)
  ON CONFLICT (member_id, session_date) DO NOTHING;
  SELECT full_name INTO v_member_name FROM wellness_members WHERE id = p_member_id;
  RETURN json_build_object('status','ok','checkin_id',v_checkin_id,'remaining',v_new_remaining,'warning',v_warning,'member_name',v_member_name);
END; $function$;
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
  v_used := v_used + (SELECT count(*) FROM wlp_checkins WHERE trial_id = p_trial_id);
  -- Leftover trial servings stay usable after the end date; extra visits begin only once all servings are used.
  v_is_extra := v_used >= v_total;
  INSERT INTO wellness_attendance(member_id, trial_id, visit_date, visit_time, checkin_method, serving_deducted, staff_id, is_trial_advance)
  VALUES (v_trial.member_id, p_trial_id, v_date,
          ((v_date + (now() AT TIME ZONE 'Asia/Kolkata')::time) AT TIME ZONE 'Asia/Kolkata'),
          'staff_entry', false, auth.uid(), v_is_extra);
  IF v_is_extra THEN v_extra := v_extra + 1; ELSE v_used := v_used + 1; END IF;
  RETURN jsonb_build_object('status','ok','extra', v_is_extra, 'used', v_used, 'total', v_total, 'extra_count', v_extra);
END $function$;