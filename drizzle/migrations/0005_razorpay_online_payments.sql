-- Online payments made by members through Razorpay.

CREATE TABLE public.razorpay_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.wellness_plans(id),
  renew_membership_id uuid REFERENCES public.wellness_memberships(id) ON DELETE SET NULL,
  context text NOT NULL DEFAULT 'activation',
  amount_paise integer NOT NULL,
  pink_credits integer NOT NULL DEFAULT 0,
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'created',
  failure_reason text,
  membership_id uuid REFERENCES public.wellness_memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX razorpay_orders_member_idx ON public.razorpay_orders(member_id);
CREATE INDEX razorpay_orders_payment_idx ON public.razorpay_orders(razorpay_payment_id);

GRANT SELECT ON public.razorpay_orders TO authenticated;
GRANT ALL ON public.razorpay_orders TO service_role;

ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own online orders"
ON public.razorpay_orders FOR SELECT TO authenticated
USING (
  public.is_wellness_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.wellness_members m
    WHERE m.id = razorpay_orders.member_id AND m.user_id = auth.uid()
  )
);

-- True only when the call arrives with the backend service credentials.
CREATE OR REPLACE FUNCTION public.is_payment_service()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_setting('role', true)
  ) = 'service_role';
$$;

-- Turns a captured Razorpay payment into a membership, pink-card redemption and payment record.
CREATE OR REPLACE FUNCTION public.fulfil_online_payment(p_order_id uuid, p_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_staff uuid;
  v_membership uuid;
  v_amount numeric;
BEGIN
  IF NOT public.is_payment_service() THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  SELECT * INTO v_order FROM public.razorpay_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid', 'membership_id', v_order.membership_id);
  END IF;

  -- Act as an admin so the existing membership functions run with their normal rules.
  SELECT user_id INTO v_staff FROM public.user_roles WHERE role = 'admin' ORDER BY id LIMIT 1;
  IF v_staff IS NULL THEN RAISE EXCEPTION 'No admin account configured.'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_staff::text, true);

  v_amount := v_order.amount_paise::numeric / 100;

  IF v_order.context = 'renewal' AND v_order.renew_membership_id IS NOT NULL THEN
    v_membership := public.renew_membership_v2(
      v_order.renew_membership_id, v_order.plan_id, NULL, v_amount,
      'extend', 'Paid online', 'online', (now() AT TIME ZONE 'Asia/Kolkata')::date
    );
  ELSE
    v_membership := public.create_membership(v_order.member_id, v_order.plan_id, v_amount);
    UPDATE public.wellness_memberships
       SET payment_mode = 'online',
           payment_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
     WHERE id = v_membership;
  END IF;

  IF v_order.pink_credits > 0 THEN
    PERFORM public.redeem_pink_card(
      v_order.member_id, v_order.pink_credits, v_membership, 'Applied on an online payment'
    );
  END IF;

  IF v_amount > 0 THEN
    PERFORM public.record_payment(
      v_membership,
      v_order.member_id,
      jsonb_build_array(jsonb_build_object('amount', v_amount, 'mode', 'online', 'reference', p_payment_id)),
      CASE WHEN v_order.context = 'renewal' THEN 'renewal' ELSE 'activation' END,
      (now() AT TIME ZONE 'Asia/Kolkata')::date
    );
  END IF;

  UPDATE public.razorpay_orders
     SET status = 'paid', razorpay_payment_id = p_payment_id,
         membership_id = v_membership, updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('status', 'paid', 'membership_id', v_membership);
END;
$$;

REVOKE ALL ON FUNCTION public.fulfil_online_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfil_online_payment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_payment_service() TO service_role, authenticated;
