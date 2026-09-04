DROP TRIGGER IF EXISTS queue_checkin_approved ON public.wellness_checkin_requests;

CREATE OR REPLACE FUNCTION public.queue_checkin_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.wellness_notification_log l
    WHERE l.member_id = NEW.member_id
      AND l.trigger_key = 'checkin_approved'
      AND (l.created_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
  ) THEN
    INSERT INTO public.wellness_notification_log(member_id, trigger_key, channel)
    VALUES (NEW.member_id, 'checkin_approved', 'whatsapp');
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER queue_checkin_notification_on_attendance
AFTER INSERT ON public.wellness_attendance
FOR EACH ROW EXECUTE FUNCTION public.queue_checkin_notification();