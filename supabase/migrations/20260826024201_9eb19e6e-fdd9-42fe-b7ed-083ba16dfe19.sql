DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wellness_members','wellness_memberships','wellness_plans','wellness_trials','wellness_batches',
    'wellness_attendance','wellness_checkin_requests','wellness_centre_settings',
    'wellness_notification_log','wellness_notification_templates',
    'serving_transactions','weight_tracking','body_measurements','member_notes',
    'member_achievements','achievement_definitions'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.expire_stale_checkin_requests() FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Managers rotate centre code" ON public.wellness_centre_settings;
CREATE POLICY "Managers rotate centre code"
ON public.wellness_centre_settings
FOR UPDATE
TO authenticated
USING (public.is_wellness_manager(auth.uid()))
WITH CHECK (public.is_wellness_manager(auth.uid()));