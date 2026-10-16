CREATE POLICY "Members view WLP sessions" ON public.wlp_sessions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.create_wlp_session(
  p_title text DEFAULT 'WLP Session',
  p_session_date date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  p_notes text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row wlp_sessions;
BEGIN
  IF NOT is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can create WLP sessions'; END IF;
  INSERT INTO wlp_sessions (title, session_date, notes, created_by)
  VALUES (p_title, p_session_date, p_notes, auth.uid()) RETURNING * INTO v_row;
  RETURN row_to_json(v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_wlp_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can delete WLP sessions'; END IF;
  SELECT count(*) INTO v_count FROM wlp_checkins WHERE session_id = p_session_id;
  IF v_count > 0 THEN RAISE EXCEPTION 'Cannot delete a session that has % check-in(s). Undo them first.', v_count; END IF;
  DELETE FROM wlp_sessions WHERE id = p_session_id;
END; $$;

CREATE OR REPLACE FUNCTION public.wlp_checkin_member(
  p_session_id uuid, p_member_id uuid, p_method public.checkin_method DEFAULT 'staff_entry'
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session wlp_sessions; v_membership wellness_memberships; v_txn_id uuid; v_checkin_id uuid;
  v_new_remaining int; v_warning text := NULL; v_member_name text; v_actor uuid;
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
    v_warning := 'no_membership';
    INSERT INTO wlp_checkins (session_id, member_id, serving_deducted, checkin_method, created_by)
    VALUES (p_session_id, p_member_id, false, p_method, v_actor)
    RETURNING id INTO v_checkin_id;
  END IF;
  INSERT INTO wellness_wlp_attendance (member_id, session_date, month, marked_by)
  VALUES (p_member_id, v_session.session_date, to_char(v_session.session_date,'YYYY-MM'), v_actor)
  ON CONFLICT (member_id, session_date) DO NOTHING;
  SELECT full_name INTO v_member_name FROM wellness_members WHERE id = p_member_id;
  RETURN json_build_object('status','ok','checkin_id',v_checkin_id,'remaining',v_new_remaining,'warning',v_warning,'member_name',v_member_name);
END; $$;

CREATE OR REPLACE FUNCTION public.undo_wlp_checkin(p_checkin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_checkin wlp_checkins; v_session_date date;
BEGIN
  IF NOT is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can undo WLP check-ins'; END IF;
  SELECT * INTO v_checkin FROM wlp_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WLP check-in not found'; END IF;
  IF v_checkin.serving_deducted AND v_checkin.membership_id IS NOT NULL THEN
    UPDATE wellness_memberships SET used_servings = used_servings - 1, remaining_servings = remaining_servings + 1, updated_at = now()
     WHERE id = v_checkin.membership_id;
  END IF;
  IF v_checkin.serving_txn_id IS NOT NULL THEN DELETE FROM serving_transactions WHERE id = v_checkin.serving_txn_id; END IF;
  SELECT session_date INTO v_session_date FROM wlp_sessions WHERE id = v_checkin.session_id;
  DELETE FROM wellness_wlp_attendance WHERE member_id = v_checkin.member_id AND session_date = v_session_date;
  DELETE FROM wlp_checkins WHERE id = p_checkin_id;
END; $$;