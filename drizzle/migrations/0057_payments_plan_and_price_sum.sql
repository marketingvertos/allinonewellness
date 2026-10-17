ALTER TABLE public.wellness_payments ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.wellness_plans(id);

UPDATE public.wellness_payments p SET plan_id = o.plan_id
  FROM public.razorpay_orders o WHERE o.razorpay_payment_id = p.reference AND p.plan_id IS NULL;
UPDATE public.wellness_payments p SET plan_id = m.plan_id
  FROM public.wellness_memberships m WHERE m.id = p.membership_id AND p.plan_id IS NULL;
UPDATE public.wellness_memberships m SET price_paid = s.total
  FROM (SELECT membership_id, sum(amount) total FROM public.wellness_payments GROUP BY membership_id) s
  WHERE s.membership_id = m.id AND m.price_paid IS DISTINCT FROM s.total;

CREATE OR REPLACE FUNCTION public.trg_payment_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan_id IS NULL THEN
    SELECT o.plan_id INTO NEW.plan_id FROM razorpay_orders o
     WHERE NEW.reference IS NOT NULL AND o.razorpay_payment_id = NEW.reference LIMIT 1;
  END IF;
  IF NEW.plan_id IS NULL THEN
    SELECT plan_id INTO NEW.plan_id FROM wellness_memberships WHERE id = NEW.membership_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_defaults ON public.wellness_payments;
CREATE TRIGGER payment_defaults BEFORE INSERT ON public.wellness_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payment_defaults();

CREATE OR REPLACE FUNCTION public.trg_payment_sum_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := COALESCE(NEW.membership_id, OLD.membership_id);
BEGIN
  UPDATE wellness_memberships SET price_paid =
    COALESCE((SELECT sum(amount) FROM wellness_payments WHERE membership_id = v_id), 0)
   WHERE id = v_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS payment_sum_price ON public.wellness_payments;
CREATE TRIGGER payment_sum_price AFTER INSERT OR UPDATE OR DELETE ON public.wellness_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payment_sum_price();