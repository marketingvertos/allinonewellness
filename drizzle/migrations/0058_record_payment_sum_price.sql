CREATE OR REPLACE FUNCTION public.record_payment(p_membership_id uuid, p_member_id uuid, p_payments jsonb, p_context text DEFAULT 'activation'::text, p_paid_on date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SET price_paid = (SELECT COALESCE(sum(amount),0) FROM public.wellness_payments WHERE membership_id = p_membership_id),
      payment_mode = COALESCE(v_first_mode, payment_mode),
      payment_date = COALESCE(p_paid_on, payment_date, CURRENT_DATE)
  WHERE id = p_membership_id;
END;
$function$;