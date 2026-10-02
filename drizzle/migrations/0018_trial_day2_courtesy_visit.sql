ALTER TABLE public.wellness_attendance ADD COLUMN IF NOT EXISTS is_trial_advance boolean NOT NULL DEFAULT false;
ALTER TYPE public.serving_txn_type ADD VALUE IF NOT EXISTS 'trial_advance_deduction';

CREATE OR REPLACE FUNCTION public.trial_advance_eligible(p_member_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id FROM wellness_trials t
  WHERE t.member_id = p_member_id
    AND t.duration_days = 1
    AND t.status NOT IN ('converted','cancelled')
    AND EXISTS (SELECT 1 FROM wellness_attendance a WHERE a.trial_id = t.id AND NOT a.is_trial_advance)
    AND NOT EXISTS (SELECT 1 FROM wellness_attendance a WHERE a.member_id = p_member_id AND a.is_trial_advance)
    AND NOT EXISTS (SELECT 1 FROM wellness_memberships m WHERE m.member_id = p_member_id AND m.status IN ('active','expiring_soon','queued'))
  ORDER BY t.start_date DESC LIMIT 1
$$;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.checkin_member(uuid, public.checkin_method)'::regprocedure);
  d := replace(d,
$a$RETURN jsonb_build_object('status','ok','mode','trial');
  END IF;$a$,
$b$RETURN jsonb_build_object('status','ok','mode','trial');
  END IF;

  IF public.trial_advance_eligible(p_member_id) IS NOT NULL THEN
    INSERT INTO wellness_attendance(member_id, trial_id, checkin_method, serving_deducted, staff_id, is_trial_advance)
    VALUES (p_member_id, public.trial_advance_eligible(p_member_id), p_method, false, auth.uid(), true);
    RETURN jsonb_build_object('status','ok','mode','trial_advance','message','Day 2 courtesy visit granted — 1 serving will be deducted when a membership is activated.');
  END IF;$b$);
  IF position('trial_advance_eligible' in d) = 0 THEN RAISE EXCEPTION 'checkin_member patch failed'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.member_self_checkin(text, numeric)'::regprocedure);
  d := replace(d,
$a$  IF NOT v_has_trial THEN
    IF v_membership.id IS NULL THEN$a$,
$b$  IF NOT v_has_trial AND v_membership.id IS NULL AND public.trial_advance_eligible(v_member_id) IS NOT NULL THEN
    INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
    VALUES (v_member_id, NULL, v_today, p_weight)
    RETURNING * INTO v_request;
    RETURN jsonb_build_object('status','pending','mode','trial_advance','request_id', v_request.id,
      'message','Welcome back! Your 1-day trial was completed. Today''s session is on us as a courtesy. Please activate your membership to continue.');
  END IF;

  IF NOT v_has_trial THEN
    IF v_membership.id IS NULL THEN$b$);
  IF position('trial_advance_eligible' in d) = 0 THEN RAISE EXCEPTION 'member_self_checkin patch failed'; END IF;
  EXECUTE d;
END $do$;

CREATE OR REPLACE FUNCTION public.trg_trial_advance_deduction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
            'Deducted 1 serving for Day 2 trial courtesy visit on ' || to_char(r.visit_date, 'DD/MM/YYYY'));
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trial_advance_deduction ON public.wellness_memberships;
CREATE TRIGGER trial_advance_deduction AFTER INSERT ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_trial_advance_deduction();