ALTER TABLE public.whatsapp_broadcast_recipients
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_reason_code text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.whatsapp_broadcasts
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_broadcast_id uuid;
CREATE INDEX IF NOT EXISTS idx_bcast_rcpt_msg ON public.whatsapp_broadcast_recipients(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_bcast_rcpt_bid ON public.whatsapp_broadcast_recipients(broadcast_id, status);

-- Mirror message receipts (delivered/read/failed) onto broadcast recipients, forward only.
CREATE OR REPLACE FUNCTION public.sync_broadcast_recipient_from_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'outbound' THEN
    UPDATE public.whatsapp_broadcast_recipients r SET
      provider_message_id = COALESCE(r.provider_message_id, NEW.provider_message_id),
      delivered_at = COALESCE(r.delivered_at, NEW.delivered_at,
        CASE WHEN NEW.status IN ('delivered','read') THEN now() END),
      read_at = COALESCE(r.read_at, NEW.read_at, CASE WHEN NEW.status = 'read' THEN now() END),
      status = CASE WHEN NEW.status = 'failed' AND r.status = 'sent' AND r.delivered_at IS NULL THEN 'failed' ELSE r.status END,
      error = CASE WHEN NEW.status = 'failed' AND r.status = 'sent' AND r.delivered_at IS NULL THEN COALESCE(NEW.error_message, 'Delivery failed') ELSE r.error END
    WHERE r.whatsapp_message_id = NEW.id;
  ELSIF NEW.direction = 'inbound' AND TG_OP = 'INSERT' AND NEW.phone IS NOT NULL THEN
    UPDATE public.whatsapp_broadcast_recipients r SET replied_at = NEW.created_at
    WHERE r.replied_at IS NULL AND r.status = 'sent'
      AND r.sent_at > NEW.created_at - interval '72 hours'
      AND right(regexp_replace(r.phone, '\D', '', 'g'), 10) = right(regexp_replace(NEW.phone, '\D', '', 'g'), 10);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_broadcast_recipient ON public.whatsapp_messages;
CREATE TRIGGER trg_sync_broadcast_recipient AFTER INSERT OR UPDATE OF status, delivered_at, read_at ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_broadcast_recipient_from_message();

-- Keep engagement counters incrementally.
CREATE OR REPLACE FUNCTION public.bump_broadcast_engagement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.whatsapp_broadcasts SET
    delivered_count = delivered_count + (CASE WHEN OLD.delivered_at IS NULL AND NEW.delivered_at IS NOT NULL THEN 1 ELSE 0 END),
    read_count = read_count + (CASE WHEN OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN 1 ELSE 0 END),
    replied_count = replied_count + (CASE WHEN OLD.replied_at IS NULL AND NEW.replied_at IS NOT NULL THEN 1 ELSE 0 END)
  WHERE id = NEW.broadcast_id
    AND ((OLD.delivered_at IS NULL AND NEW.delivered_at IS NOT NULL) OR (OLD.read_at IS NULL AND NEW.read_at IS NOT NULL) OR (OLD.replied_at IS NULL AND NEW.replied_at IS NOT NULL));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_broadcast_engagement ON public.whatsapp_broadcast_recipients;
CREATE TRIGGER trg_bump_broadcast_engagement AFTER UPDATE OF delivered_at, read_at, replied_at ON public.whatsapp_broadcast_recipients
FOR EACH ROW EXECUTE FUNCTION public.bump_broadcast_engagement();

-- Backfill
UPDATE public.whatsapp_broadcast_recipients r SET
  provider_message_id = m.provider_message_id,
  delivered_at = COALESCE(m.delivered_at, CASE WHEN m.status IN ('delivered','read') THEN m.updated_at END, m.read_at),
  read_at = COALESCE(m.read_at, CASE WHEN m.status = 'read' THEN m.updated_at END)
FROM public.whatsapp_messages m WHERE m.id = r.whatsapp_message_id;
UPDATE public.whatsapp_broadcast_recipients r SET replied_at = (
  SELECT min(m.created_at) FROM public.whatsapp_messages m
  WHERE m.direction = 'inbound' AND m.created_at > r.sent_at AND m.created_at < r.sent_at + interval '72 hours'
    AND right(regexp_replace(m.phone, '\D', '', 'g'), 10) = right(regexp_replace(r.phone, '\D', '', 'g'), 10))
WHERE r.status = 'sent' AND r.sent_at IS NOT NULL;
UPDATE public.whatsapp_broadcasts b SET
  delivered_count = s.d, read_count = s.rd, replied_count = s.rp,
  started_at = COALESCE(b.started_at, b.created_at),
  completed_at = CASE WHEN b.status = 'completed' THEN COALESCE(b.completed_at, b.updated_at) END
FROM (SELECT broadcast_id, count(delivered_at) d, count(read_at) rd, count(replied_at) rp
      FROM public.whatsapp_broadcast_recipients GROUP BY broadcast_id) s
WHERE s.broadcast_id = b.id;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_broadcasts;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_broadcast_recipients;
EXCEPTION WHEN others THEN NULL; END $$;