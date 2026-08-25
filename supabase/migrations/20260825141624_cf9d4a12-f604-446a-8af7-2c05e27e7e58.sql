CREATE INDEX IF NOT EXISTS idx_wellness_members_batch ON public.wellness_members(batch_id);
CREATE INDEX IF NOT EXISTS idx_wellness_members_referrer ON public.wellness_members(referred_by_member_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON public.wellness_notification_log(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.mark_notification_sent(p_log_id uuid, p_status text DEFAULT 'sent', p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  IF p_status NOT IN ('sent','failed','queued') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;
  UPDATE public.wellness_notification_log
     SET status = p_status,
         error_message = p_error,
         sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE NULL END
   WHERE id = p_log_id;
END; $$;

REVOKE ALL ON FUNCTION public.mark_notification_sent(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(uuid, text, text) TO authenticated;