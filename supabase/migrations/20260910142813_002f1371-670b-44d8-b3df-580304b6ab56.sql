CREATE TABLE public.pink_card_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  change integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  reference_id uuid,
  referred_member_id uuid REFERENCES public.wellness_members(id) ON DELETE SET NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pink_card_ledger_member ON public.pink_card_ledger(member_id);
CREATE INDEX idx_pink_card_ledger_reference ON public.pink_card_ledger(reference_id);

GRANT SELECT ON public.pink_card_ledger TO authenticated;
GRANT ALL ON public.pink_card_ledger TO service_role;

ALTER TABLE public.pink_card_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pink card ledger"
ON public.pink_card_ledger FOR SELECT TO authenticated
USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));

ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS pink_card_balance integer NOT NULL DEFAULT 0;

-- award helper -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_pink_card(
  p_referred_member_id uuid,
  p_change integer,
  p_reason text,
  p_reference_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_balance integer;
BEGIN
  SELECT referred_by_member_id INTO v_referrer
  FROM wellness_members WHERE id = p_referred_member_id;
  IF v_referrer IS NULL OR v_referrer = p_referred_member_id THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM pink_card_ledger
    WHERE referred_member_id = p_referred_member_id AND reason = p_reason
  ) THEN RETURN; END IF;

  UPDATE wellness_members
     SET pink_card_balance = pink_card_balance + p_change
   WHERE id = v_referrer
  RETURNING pink_card_balance INTO v_balance;

  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, reference_id, referred_member_id)
  VALUES (v_referrer, p_change, v_balance, p_reason, p_reference_id, p_referred_member_id);
END; $$;

CREATE OR REPLACE FUNCTION public.trg_pink_card_trial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_pink_card(NEW.member_id, 1, 'trial_referral', NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER pink_card_on_trial
AFTER INSERT ON public.wellness_trials
FOR EACH ROW EXECUTE FUNCTION public.trg_pink_card_trial();

CREATE OR REPLACE FUNCTION public.trg_pink_card_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days integer;
BEGIN
  SELECT duration_days INTO v_days FROM wellness_plans WHERE id = NEW.plan_id;
  IF COALESCE(v_days, 0) >= 28 THEN
    PERFORM public.award_pink_card(NEW.member_id, 3, 'membership_referral', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER pink_card_on_membership
AFTER INSERT ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_pink_card_membership();

-- redemption ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_pink_card(
  p_member_id uuid,
  p_credits integer,
  p_membership_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF COALESCE(p_credits, 0) <= 0 THEN RAISE EXCEPTION 'Credits must be positive.'; END IF;

  SELECT pink_card_balance INTO v_balance FROM wellness_members WHERE id = p_member_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Member not found.'; END IF;
  IF p_credits > v_balance THEN RAISE EXCEPTION 'Not enough Pink Card credit.'; END IF;

  v_balance := v_balance - p_credits;
  UPDATE wellness_members SET pink_card_balance = v_balance WHERE id = p_member_id;

  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, reference_id, note, created_by)
  VALUES (p_member_id, -p_credits, v_balance, 'renewal_redemption', p_membership_id, p_note, auth.uid());

  RETURN v_balance;
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_pink_card(
  p_member_id uuid,
  p_change integer,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance integer;
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF COALESCE(p_change, 0) = 0 THEN RAISE EXCEPTION 'Change must not be zero.'; END IF;

  SELECT pink_card_balance INTO v_balance FROM wellness_members WHERE id = p_member_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Member not found.'; END IF;

  v_balance := GREATEST(v_balance + p_change, 0);
  UPDATE wellness_members SET pink_card_balance = v_balance WHERE id = p_member_id;

  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, note, created_by)
  VALUES (p_member_id, p_change, v_balance, 'manual_adjustment', p_note, auth.uid());

  RETURN v_balance;
END; $$;