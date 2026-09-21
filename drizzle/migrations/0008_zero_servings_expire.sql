CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;
  UPDATE wellness_memberships SET status = 'expired'
    WHERE status IN ('active','expiring_soon') AND (end_date < v_today OR remaining_servings <= 0);
  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND (end_date - v_today) <= 5 AND end_date >= v_today;
  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));
  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END; $function$;

CREATE OR REPLACE FUNCTION public.trg_expire_on_zero_servings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_next uuid;
BEGIN
  IF NEW.remaining_servings > 0 OR NEW.status NOT IN ('active','expiring_soon') THEN
    RETURN NEW;
  END IF;

  UPDATE wellness_memberships SET status = 'expired' WHERE id = NEW.id;

  v_next := public.activate_next_membership(NEW.member_id);

  IF v_next IS NULL THEN
    UPDATE wellness_members m SET status = 'expired'
     WHERE m.id = NEW.member_id
       AND m.status IN ('active_member','renewal_due')
       AND NOT EXISTS (
         SELECT 1 FROM wellness_memberships ms
          WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued')
       );
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS expire_on_zero_servings ON public.wellness_memberships;
CREATE TRIGGER expire_on_zero_servings
AFTER UPDATE OF remaining_servings ON public.wellness_memberships
FOR EACH ROW
WHEN (NEW.remaining_servings <= 0)
EXECUTE FUNCTION public.trg_expire_on_zero_servings();