ALTER TABLE public.wellness_memberships ADD COLUMN IF NOT EXISTS servings_exhausted_on date;

CREATE OR REPLACE FUNCTION public.trg_expire_on_zero_servings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_next uuid;
BEGIN
  IF NEW.remaining_servings > 0 THEN
    IF NEW.servings_exhausted_on IS NOT NULL THEN
      UPDATE wellness_memberships SET servings_exhausted_on = NULL WHERE id = NEW.id;
    END IF;
    IF NEW.status IN ('active','expiring_soon') THEN
      UPDATE wellness_members m SET status = 'active_member'
       WHERE m.id = NEW.member_id AND m.status IN ('renewal_due','expired');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('active','expiring_soon') THEN
    RETURN NEW;
  END IF;

  -- balance hit zero: start the 10-day renewal window instead of expiring
  UPDATE wellness_memberships
     SET status = 'expiring_soon',
         servings_exhausted_on = COALESCE(servings_exhausted_on, v_today)
   WHERE id = NEW.id;

  v_next := public.activate_next_membership(NEW.member_id);

  IF v_next IS NOT NULL THEN
    UPDATE wellness_memberships SET servings_exhausted_on = NULL WHERE id = v_next;
    UPDATE wellness_members m SET status = 'active_member'
     WHERE m.id = NEW.member_id AND m.status IN ('renewal_due','expired');
  ELSE
    UPDATE wellness_members m SET status = 'renewal_due'
     WHERE m.id = NEW.member_id AND m.status IN ('active_member','expired');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expire_on_zero_servings ON public.wellness_memberships;
CREATE TRIGGER expire_on_zero_servings
AFTER UPDATE OF remaining_servings ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_expire_on_zero_servings();

CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;

  -- date-based expiry, plus zero-serving memberships past the 10-day renewal window
  UPDATE wellness_memberships SET status = 'expired'
    WHERE status IN ('active','expiring_soon')
      AND (
        end_date < v_today
        OR (remaining_servings <= 0 AND servings_exhausted_on IS NOT NULL AND servings_exhausted_on < v_today - 10)
      );

  -- zero balance without a stamp (legacy rows): start the window today
  UPDATE wellness_memberships SET servings_exhausted_on = v_today
    WHERE status IN ('active','expiring_soon') AND remaining_servings <= 0 AND servings_exhausted_on IS NULL;

  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND ((end_date - v_today) <= 5 AND end_date >= v_today OR remaining_servings <= 0);

  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));

  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END;
$$;