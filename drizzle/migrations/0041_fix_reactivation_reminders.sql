CREATE OR REPLACE FUNCTION public.queue_reactivation_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r wellness_memberships; v_days int;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (ms.member_id) ms.*
    FROM wellness_memberships ms
    ORDER BY ms.member_id, ms.end_date DESC, ms.created_at DESC
  LOOP
    CONTINUE WHEN r.status <> 'expired';
    CONTINUE WHEN EXISTS (SELECT 1 FROM wellness_memberships o WHERE o.member_id = r.member_id
                          AND o.status IN ('queued','active','expiring_soon'));
    v_days := v_today - public.membership_expired_on(r);
    CONTINUE WHEN v_days NOT IN (0,7,15,30);
    INSERT INTO wellness_notification_log(member_id, trigger_key, channel, dedupe_key)
    VALUES (r.member_id, 'membership_reactivation_' || v_days, 'whatsapp',
            'membership_reactivation_' || v_days || ':' || r.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.queue_reactivation_reminders() FROM anon, authenticated, public;