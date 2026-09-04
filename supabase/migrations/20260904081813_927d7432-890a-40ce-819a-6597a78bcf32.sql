ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS anniversary_date date;

CREATE OR REPLACE FUNCTION public.trg_weight_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_member_achievements(COALESCE(NEW.member_id, OLD.member_id));
  RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.trg_weight_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS weight_achievements_sync ON public.weight_tracking;
CREATE TRIGGER weight_achievements_sync
AFTER INSERT OR UPDATE OR DELETE ON public.weight_tracking
FOR EACH ROW EXECUTE FUNCTION public.trg_weight_achievements();