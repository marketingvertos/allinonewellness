CREATE OR REPLACE FUNCTION public.trg_membership_plan_sync_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    UPDATE public.wellness_payments SET plan_id = NEW.plan_id
     WHERE membership_id = NEW.id AND context = 'renewal' AND plan_id = OLD.plan_id
       AND paid_at >= COALESCE(NEW.updated_at, now()) - interval '1 day';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS membership_plan_sync_payments ON public.wellness_memberships;
CREATE TRIGGER membership_plan_sync_payments AFTER UPDATE OF plan_id ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_membership_plan_sync_payments();
UPDATE public.wellness_payments p SET plan_id = m.plan_id
FROM public.wellness_memberships m, public.wellness_plans np, public.wellness_plans mp
WHERE p.membership_id = m.id AND p.context = 'renewal' AND np.id = p.plan_id AND mp.id = m.plan_id
  AND p.plan_id <> m.plan_id AND np.name ILIKE '%new%' AND mp.name ILIKE '%renew%';