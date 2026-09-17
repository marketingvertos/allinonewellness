DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
    CREATE TYPE public.payment_mode AS ENUM ('cash','upi','online','card');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.wellness_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.wellness_memberships(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  mode public.payment_mode NOT NULL,
  reference text,
  note text,
  context text NOT NULL DEFAULT 'activation',
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_membership ON public.wellness_payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.wellness_payments(paid_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_payments TO authenticated;
GRANT ALL ON public.wellness_payments TO service_role;

ALTER TABLE public.wellness_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage payments" ON public.wellness_payments;
CREATE POLICY "Staff can manage payments"
  ON public.wellness_payments FOR ALL
  TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_payment(
  p_membership_id uuid,
  p_member_id uuid,
  p_payments jsonb,
  p_context text DEFAULT 'activation',
  p_paid_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment jsonb;
  v_total numeric := 0;
  v_first_mode text;
  v_paid_at timestamptz := COALESCE(p_paid_on::timestamptz, now());
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment line is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF COALESCE((v_payment->>'amount')::numeric, 0) <= 0 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.wellness_payments (
      membership_id, member_id, amount, mode, reference, context, paid_at, recorded_by
    ) VALUES (
      p_membership_id,
      p_member_id,
      (v_payment->>'amount')::numeric,
      (v_payment->>'mode')::public.payment_mode,
      NULLIF(v_payment->>'reference', ''),
      p_context,
      v_paid_at,
      auth.uid()
    );
    v_total := v_total + (v_payment->>'amount')::numeric;
    IF v_first_mode IS NULL THEN v_first_mode := v_payment->>'mode'; END IF;
  END LOOP;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'At least one payment line with an amount is required';
  END IF;

  UPDATE public.wellness_memberships
  SET price_paid = v_total,
      payment_mode = COALESCE(v_first_mode, payment_mode),
      payment_date = COALESCE(p_paid_on, payment_date, CURRENT_DATE)
  WHERE id = p_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment(uuid, uuid, jsonb, text, date) TO authenticated;