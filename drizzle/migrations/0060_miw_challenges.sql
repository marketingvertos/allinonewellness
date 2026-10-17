-- MIW 21-Day Challenge: dedicated tables, payment path, registration & report RPCs.

-- 1. miw_challenges table
CREATE TABLE IF NOT EXISTS public.miw_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'MIW 21-Day Challenge',
  start_date date NOT NULL,
  end_date date NOT NULL,
  fee numeric(10,2) NOT NULL DEFAULT 500,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_miw_challenges_status ON public.miw_challenges (status);

ALTER TABLE public.miw_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access on miw_challenges"
  ON public.miw_challenges FOR ALL
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Members can read open challenges"
  ON public.miw_challenges FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Make wellness_payments.membership_id nullable for MIW payments
ALTER TABLE public.wellness_payments
  ALTER COLUMN membership_id DROP NOT NULL;

-- 3. miw_participants table
CREATE TABLE IF NOT EXISTS public.miw_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.miw_challenges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.wellness_payments(id),
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','online')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, member_id)
);

CREATE INDEX idx_miw_participants_challenge ON public.miw_participants (challenge_id);
CREATE INDEX idx_miw_participants_member ON public.miw_participants (member_id);

ALTER TABLE public.miw_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access on miw_participants"
  ON public.miw_participants FOR ALL
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Members read own participation"
  ON public.miw_participants FOR SELECT
  USING (member_id IN (SELECT id FROM public.wellness_members WHERE user_id = auth.uid()));

-- 4. Add miw_participant_id FK on wellness_payments
ALTER TABLE public.wellness_payments
  ADD COLUMN IF NOT EXISTS miw_participant_id uuid REFERENCES public.miw_participants(id);

-- 5. Staff RPC: register a member for a challenge with payment
CREATE OR REPLACE FUNCTION public.miw_register_member(
  p_challenge_id uuid,
  p_member_id uuid,
  p_payments jsonb DEFAULT '[{"amount":500,"mode":"cash"}]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge record;
  v_participant_id uuid;
  v_payment_id uuid;
  v_pay jsonb;
  v_amount numeric;
  v_mode text;
  v_ref text;
  v_total numeric := 0;
  v_member record;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  SELECT * INTO v_challenge FROM miw_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found.';
  END IF;

  IF EXISTS (SELECT 1 FROM miw_participants WHERE challenge_id = p_challenge_id AND member_id = p_member_id) THEN
    RETURN jsonb_build_object('status', 'already_registered', 'message', 'Member is already registered for this challenge.');
  END IF;

  SELECT * INTO v_member FROM wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  -- Create participant record
  INSERT INTO miw_participants (challenge_id, member_id, source)
  VALUES (p_challenge_id, p_member_id, 'staff')
  RETURNING id INTO v_participant_id;

  -- Record payments (split payment support)
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := (v_pay->>'amount')::numeric;
    v_mode := v_pay->>'mode';
    v_ref := v_pay->>'reference';
    IF v_amount <= 0 THEN CONTINUE; END IF;
    v_total := v_total + v_amount;

    INSERT INTO wellness_payments (member_id, membership_id, amount, mode, reference, context, recorded_by, miw_participant_id)
    VALUES (p_member_id, NULL, v_amount, v_mode::payment_mode, v_ref, 'miw', auth.uid(), v_participant_id)
    RETURNING id INTO v_payment_id;
  END LOOP;

  -- Update participant with first payment ref
  IF v_payment_id IS NOT NULL THEN
    UPDATE miw_participants SET payment_id = v_payment_id WHERE id = v_participant_id;
  END IF;

  -- Add MIW tag to member if not already present
  UPDATE wellness_members
  SET tags = array_append(COALESCE(tags, '{}'), 'miw')
  WHERE id = p_member_id AND NOT (COALESCE(tags, '{}') @> ARRAY['miw']);

  RETURN jsonb_build_object(
    'status', 'ok',
    'participant_id', v_participant_id,
    'amount_paid', v_total,
    'member_name', v_member.full_name
  );
END;
$$;

-- 6. Report RPC: returns challenge participants with weight data
CREATE OR REPLACE FUNCTION public.miw_report(p_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge record;
  v_participants jsonb;
  v_total_paid numeric;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  SELECT * INTO v_challenge FROM miw_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found.';
  END IF;

  SELECT COALESCE(sum(wp.amount), 0) INTO v_total_paid
  FROM wellness_payments wp
  JOIN miw_participants mp ON mp.id = wp.miw_participant_id
  WHERE mp.challenge_id = p_challenge_id AND wp.context = 'miw';

  SELECT jsonb_agg(
    jsonb_build_object(
      'participant_id', mp.id,
      'member_id', mp.member_id,
      'member_name', m.full_name,
      'mobile', m.mobile_number,
      'gender', m.gender,
      'source', mp.source,
      'joined_at', mp.joined_at,
      'start_weight', sw.weight,
      'latest_weight', lw.weight,
      'visits', (
        SELECT count(*) FROM wellness_attendance a
        WHERE a.member_id = mp.member_id
          AND a.visit_date BETWEEN v_challenge.start_date AND v_challenge.end_date
      )
    )
    ORDER BY
      CASE WHEN lw.weight IS NOT NULL AND sw.weight IS NOT NULL
           THEN lw.weight - sw.weight ELSE NULL END NULLS LAST
  ) INTO v_participants
  FROM miw_participants mp
  JOIN wellness_members m ON m.id = mp.member_id
  LEFT JOIN LATERAL (
    SELECT w.weight FROM wellness_weight_records w
    WHERE w.member_id = mp.member_id AND w.recorded_date <= v_challenge.start_date
    ORDER BY w.recorded_date DESC LIMIT 1
  ) sw ON true
  LEFT JOIN LATERAL (
    SELECT w.weight FROM wellness_weight_records w
    WHERE w.member_id = mp.member_id
      AND w.recorded_date BETWEEN v_challenge.start_date AND v_challenge.end_date
    ORDER BY w.recorded_date DESC LIMIT 1
  ) lw ON true
  WHERE mp.challenge_id = p_challenge_id;

  RETURN jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', v_challenge.id,
      'name', v_challenge.name,
      'start_date', v_challenge.start_date,
      'end_date', v_challenge.end_date,
      'fee', v_challenge.fee,
      'status', v_challenge.status
    ),
    'total_paid', v_total_paid,
    'participant_count', (SELECT count(*) FROM miw_participants WHERE challenge_id = p_challenge_id),
    'participants', COALESCE(v_participants, '[]'::jsonb)
  );
END;
$$;

-- 7. Grants
GRANT SELECT ON public.miw_challenges TO anon, authenticated;
GRANT ALL ON public.miw_challenges TO authenticated;
GRANT SELECT ON public.miw_participants TO anon, authenticated;
GRANT ALL ON public.miw_participants TO authenticated;
