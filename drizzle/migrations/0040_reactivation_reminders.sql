CREATE OR REPLACE FUNCTION public.membership_expired_on(_ms public.wellness_memberships)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _ms.servings_exhausted_on IS NOT NULL
              THEN LEAST(_ms.servings_exhausted_on + 11, _ms.end_date + 1)
              ELSE _ms.end_date + 1 END
$$;

CREATE OR REPLACE FUNCTION public.queue_reactivation_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r record; v_days int;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (ms.member_id) ms.*
    FROM wellness_memberships ms
    ORDER BY ms.member_id, ms.end_date DESC, ms.created_at DESC
  LOOP
    CONTINUE WHEN r.status <> 'expired';
    CONTINUE WHEN EXISTS (SELECT 1 FROM wellness_memberships o WHERE o.member_id = r.member_id
                          AND o.status IN ('queued','active','expiring_soon'));
    v_days := v_today - public.membership_expired_on(r::wellness_memberships);
    CONTINUE WHEN v_days NOT IN (0,7,15,30);
    INSERT INTO wellness_notification_log(member_id, trigger_key, channel, dedupe_key)
    VALUES (r.member_id, 'membership_reactivation_' || v_days, 'whatsapp',
            'membership_reactivation_' || v_days || ':' || r.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.queue_reactivation_reminders() FROM anon, authenticated, public;

-- Old one-off expiry message is replaced by the reactivation series.
CREATE OR REPLACE FUNCTION public.drop_legacy_expired_notification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.trigger_key = 'membership_expired' THEN RETURN NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS drop_legacy_expired_notification ON public.wellness_notification_log;
CREATE TRIGGER drop_legacy_expired_notification BEFORE INSERT ON public.wellness_notification_log
  FOR EACH ROW EXECUTE FUNCTION public.drop_legacy_expired_notification();