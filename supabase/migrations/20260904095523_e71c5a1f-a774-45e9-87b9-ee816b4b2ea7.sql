
UPDATE public.wellness_notification_log
SET status = 'cancelled',
    error_message = 'Skipped: queued before WhatsApp automation went live'
WHERE status = 'queued' AND created_at < now();
