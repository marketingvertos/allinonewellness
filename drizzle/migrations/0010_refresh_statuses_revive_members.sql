CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;

  UPDATE wellness_memberships SET status = 'expired'
    WHERE status IN ('active','expiring_soon')
      AND (
        end_date < v_today
        OR (remaining_servings <= 0 AND servings_exhausted_on IS NOT NULL AND servings_exhausted_on < v_today - 10)
      );

  UPDATE wellness_memberships SET servings_exhausted_on = v_today
    WHERE status IN ('active','expiring_soon') AND remaining_servings <= 0 AND servings_exhausted_on IS NULL;

  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND (((end_date - v_today) <= 5 AND end_date >= v_today) OR remaining_servings <= 0);

  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));

  -- members with a live plan again (renewal, queued activation, restored window) leave the expired list
  UPDATE wellness_members m SET status = 'active_member'
    WHERE m.status = 'expired'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));

  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END;
$$;