CREATE OR REPLACE FUNCTION public.trg_clear_guest_on_paid_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME = 'wellness_memberships' OR EXISTS (
    SELECT 1 FROM public.wellness_plans p WHERE p.id = NEW.plan_id AND p.price > 0
  ) THEN
    UPDATE public.wellness_members SET is_guest = false WHERE id = NEW.member_id AND is_guest;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clear_guest_on_membership ON public.wellness_memberships;
CREATE TRIGGER clear_guest_on_membership AFTER INSERT ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_clear_guest_on_paid_plan();
DROP TRIGGER IF EXISTS clear_guest_on_paid_trial ON public.wellness_trials;
CREATE TRIGGER clear_guest_on_paid_trial AFTER INSERT ON public.wellness_trials
FOR EACH ROW EXECUTE FUNCTION public.trg_clear_guest_on_paid_plan();