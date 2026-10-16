-- WLP Sessions: dedicated evening session management with serving deduction
-- Adds session-based WLP check-in alongside the existing wellness_wlp_attendance
-- (which continues to drive coach rewards).

-- 1. New serving transaction type
ALTER TYPE public.serving_txn_type ADD VALUE IF NOT EXISTS 'wlp_deduction';

-- 2. Allow serving balance to go negative (WLP overdraft with warning).
--    Regular checkin_member already guards against zero-balance morning check-ins.
ALTER TABLE public.wellness_memberships DROP CONSTRAINT IF EXISTS remaining_not_negative;

-- 3. WLP sessions table
CREATE TABLE IF NOT EXISTS public.wlp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'WLP Session',
  session_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wlp_sessions_one_per_date UNIQUE (session_date)
);

CREATE INDEX IF NOT EXISTS idx_wlp_sessions_date ON public.wlp_sessions(session_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wlp_sessions TO authenticated;
GRANT ALL ON public.wlp_sessions TO service_role;

ALTER TABLE public.wlp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage WLP sessions"
  ON public.wlp_sessions FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

-- 4. WLP check-ins table
CREATE TABLE IF NOT EXISTS public.wlp_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.wlp_sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.wellness_memberships(id),
  serving_deducted boolean NOT NULL DEFAULT false,
  serving_txn_id uuid REFERENCES public.serving_transactions(id) ON DELETE SET NULL,
  checkin_method public.checkin_method NOT NULL DEFAULT 'staff_entry',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  CONSTRAINT wlp_checkins_one_per_session UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_wlp_checkins_session ON public.wlp_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_wlp_checkins_member ON public.wlp_checkins(member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wlp_checkins TO authenticated;
GRANT ALL ON public.wlp_checkins TO service_role;

ALTER TABLE public.wlp_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage WLP check-ins"
  ON public.wlp_checkins FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Members view own WLP check-ins"
  ON public.wlp_checkins FOR SELECT TO authenticated
  USING (public.owns_wellness_member(auth.uid(), member_id));

-- 5a. create_wlp_session
CREATE OR REPLACE FUNCTION public.create_wlp_session(
  p_title text DEFAULT 'WLP Session',
  p_session_date date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  p_notes text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row wlp_sessions;
BEGIN
  INSERT INTO wlp_sessions (title, session_date, notes, created_by)
  VALUES (p_title, p_session_date, p_notes, auth.uid())
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wlp_session TO authenticated;

-- 5b. delete_wlp_session
CREATE OR REPLACE FUNCTION public.delete_wlp_session(
  p_session_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM wlp_checkins WHERE session_id = p_session_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete a session that has % check-in(s). Undo them first.', v_count;
  END IF;
  DELETE FROM wlp_sessions WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_wlp_session TO authenticated;

-- 5c. wlp_checkin_member
CREATE OR REPLACE FUNCTION public.wlp_checkin_member(
  p_session_id uuid,
  p_member_id uuid,
  p_method public.checkin_method DEFAULT 'staff_entry'
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session wlp_sessions;
  v_membership wellness_memberships;
  v_txn_id uuid;
  v_checkin_id uuid;
  v_new_remaining int;
  v_warning text := NULL;
  v_member_name text;
BEGIN
  -- validate session
  SELECT * INTO v_session FROM wlp_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WLP session not found';
  END IF;

  -- duplicate check (unique constraint is the real guard)
  IF EXISTS (SELECT 1 FROM wlp_checkins WHERE session_id = p_session_id AND member_id = p_member_id) THEN
    SELECT full_name INTO v_member_name FROM wellness_members WHERE id = p_member_id;
    RETURN json_build_object('status', 'duplicate', 'message',
      coalesce(v_member_name, 'Member') || ' is already checked in to this session.');
  END IF;

  -- find active membership
  SELECT * INTO v_membership
    FROM wellness_memberships
   WHERE member_id = p_member_id AND status IN ('active', 'expiring_soon')
   ORDER BY end_date LIMIT 1;

  IF FOUND THEN
    -- overdraft warning
    IF v_membership.remaining_servings <= 0 THEN
      v_warning := 'overdraft';
    END IF;

    v_new_remaining := v_membership.remaining_servings - 1;

    -- deduct serving
    UPDATE wellness_memberships
       SET used_servings = used_servings + 1,
           remaining_servings = remaining_servings - 1,
           updated_at = now()
     WHERE id = v_membership.id;

    -- serving transaction
    INSERT INTO serving_transactions (member_id, membership_id, txn_type, change, balance_after, note, created_by)
    VALUES (p_member_id, v_membership.id, 'wlp_deduction', -1, v_new_remaining,
            'WLP session: ' || v_session.title || ' (' || v_session.session_date || ')',
            auth.uid())
    RETURNING id INTO v_txn_id;

    -- wlp check-in
    INSERT INTO wlp_checkins (session_id, member_id, membership_id, serving_deducted, serving_txn_id, checkin_method, created_by)
    VALUES (p_session_id, p_member_id, v_membership.id, true, v_txn_id, p_method, auth.uid())
    RETURNING id INTO v_checkin_id;
  ELSE
    v_warning := 'no_membership';

    -- check-in without serving deduction
    INSERT INTO wlp_checkins (session_id, member_id, serving_deducted, checkin_method, created_by)
    VALUES (p_session_id, p_member_id, false, p_method, auth.uid())
    RETURNING id INTO v_checkin_id;

    v_new_remaining := NULL;
  END IF;

  -- also insert into legacy wellness_wlp_attendance for coach rewards compatibility
  INSERT INTO wellness_wlp_attendance (member_id, session_date, month, marked_by)
  VALUES (p_member_id, v_session.session_date, to_char(v_session.session_date, 'YYYY-MM'), auth.uid())
  ON CONFLICT (member_id, session_date) DO NOTHING;

  SELECT full_name INTO v_member_name FROM wellness_members WHERE id = p_member_id;

  RETURN json_build_object(
    'status', 'ok',
    'checkin_id', v_checkin_id,
    'remaining', v_new_remaining,
    'warning', v_warning,
    'member_name', v_member_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wlp_checkin_member TO authenticated;

-- 5d. undo_wlp_checkin
CREATE OR REPLACE FUNCTION public.undo_wlp_checkin(
  p_checkin_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin wlp_checkins;
  v_session_date date;
BEGIN
  SELECT * INTO v_checkin FROM wlp_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WLP check-in not found';
  END IF;

  -- reverse serving deduction
  IF v_checkin.serving_deducted AND v_checkin.membership_id IS NOT NULL THEN
    UPDATE wellness_memberships
       SET used_servings = used_servings - 1,
           remaining_servings = remaining_servings + 1,
           updated_at = now()
     WHERE id = v_checkin.membership_id;
  END IF;

  -- delete serving transaction
  IF v_checkin.serving_txn_id IS NOT NULL THEN
    DELETE FROM serving_transactions WHERE id = v_checkin.serving_txn_id;
  END IF;

  -- get session date for legacy table cleanup
  SELECT session_date INTO v_session_date FROM wlp_sessions WHERE id = v_checkin.session_id;

  -- remove legacy attendance row
  DELETE FROM wellness_wlp_attendance
   WHERE member_id = v_checkin.member_id AND session_date = v_session_date;

  -- delete check-in
  DELETE FROM wlp_checkins WHERE id = p_checkin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_wlp_checkin TO authenticated;

-- 5e. wlp_self_checkin (for member QR scan)
CREATE OR REPLACE FUNCTION public.wlp_self_checkin(
  p_session_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  -- find member by auth user
  SELECT id INTO v_member_id
    FROM wellness_members
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'No member profile linked to this account.');
  END IF;

  RETURN wlp_checkin_member(p_session_id, v_member_id, 'qr_scan');
END;
$$;

GRANT EXECUTE ON FUNCTION public.wlp_self_checkin TO authenticated;
