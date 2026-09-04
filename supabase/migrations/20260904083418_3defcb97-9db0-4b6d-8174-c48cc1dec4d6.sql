-- 1. Integration credentials -------------------------------------------------
CREATE TABLE public.integration_credentials (
  key text PRIMARY KEY,
  value text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_credentials TO authenticated;
GRANT ALL ON public.integration_credentials TO service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage integration credentials"
  ON public.integration_credentials FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid()))
  WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_integration_credentials_updated_at
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Conversations ------------------------------------------------------------
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  member_id uuid REFERENCES public.wellness_members(id) ON DELETE SET NULL,
  display_name text,
  status text NOT NULL DEFAULT 'open',
  unread_count integer NOT NULL DEFAULT 0,
  last_direction text,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage whatsapp conversations"
  ON public.whatsapp_conversations FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wa_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

-- 3. Messages -----------------------------------------------------------------
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.wellness_members(id) ON DELETE SET NULL,
  phone text,
  direction text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  source_module text NOT NULL DEFAULT 'manual',
  template_name text,
  message_content text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  provider_message_id text,
  sent_by uuid,
  is_bot boolean NOT NULL DEFAULT false,
  retry_of_message_id uuid,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage whatsapp messages"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wa_messages_conversation ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wa_messages_provider_id ON public.whatsapp_messages(provider_message_id);
CREATE INDEX idx_wa_messages_created ON public.whatsapp_messages(created_at DESC);

-- 4. API logs -----------------------------------------------------------------
CREATE TABLE public.whatsapp_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  function_name text,
  message_id uuid,
  phone text,
  ok boolean NOT NULL DEFAULT false,
  http_status integer,
  provider_code text,
  provider_message_id text,
  error text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_api_logs TO authenticated;
GRANT ALL ON public.whatsapp_api_logs TO service_role;
ALTER TABLE public.whatsapp_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read whatsapp api logs"
  ON public.whatsapp_api_logs FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()));
CREATE INDEX idx_wa_api_logs_created ON public.whatsapp_api_logs(created_at DESC);

-- 5. Webhook logs -------------------------------------------------------------
CREATE TABLE public.whatsapp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  phone text,
  provider_message_id text,
  processing_status text NOT NULL DEFAULT 'received',
  error text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_webhook_logs TO authenticated;
GRANT ALL ON public.whatsapp_webhook_logs TO service_role;
ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read whatsapp webhook logs"
  ON public.whatsapp_webhook_logs FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()));
CREATE INDEX idx_wa_webhook_logs_created ON public.whatsapp_webhook_logs(created_at DESC);

-- 6. Template + queue extensions ----------------------------------------------
ALTER TABLE public.wellness_notification_templates
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_language text,
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.wellness_notification_log
  ADD COLUMN IF NOT EXISTS whatsapp_message_id uuid,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wellness_notification_log_status
  ON public.wellness_notification_log(status, created_at);

-- 7. Queue a notification when a check-in is approved --------------------------
CREATE OR REPLACE FUNCTION public.queue_checkin_approved_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.wellness_notification_log(member_id, trigger_key, channel)
    VALUES (NEW.member_id, 'checkin_approved', 'whatsapp');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS queue_checkin_approved ON public.wellness_checkin_requests;
CREATE TRIGGER queue_checkin_approved
  AFTER UPDATE ON public.wellness_checkin_requests
  FOR EACH ROW EXECUTE FUNCTION public.queue_checkin_approved_notification();