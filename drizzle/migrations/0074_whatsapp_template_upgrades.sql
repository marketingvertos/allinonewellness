ALTER TABLE public.wellness_notification_templates
  ADD COLUMN IF NOT EXISTS next_template_name text,
  ADD COLUMN IF NOT EXISTS next_variables jsonb,
  ADD COLUMN IF NOT EXISTS next_status text;
ALTER TABLE public.wellness_notification_log
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.queue_member_notification_payload(p_member_id uuid, p_trigger text, p_dedupe interval, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_member_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.wellness_notification_log
    WHERE member_id = p_member_id AND trigger_key = p_trigger AND created_at > now() - p_dedupe) THEN RETURN; END IF;
  INSERT INTO public.wellness_notification_log (member_id, trigger_key, channel, status, payload)
  VALUES (p_member_id, p_trigger, 'whatsapp', 'queued', coalesce(p_payload, '{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.queue_member_notification_payload(uuid, text, interval, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_milestone_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cat text; v_name text;
BEGIN
  SELECT category, name INTO v_cat, v_name FROM public.achievement_definitions WHERE id = NEW.achievement_id;
  IF v_cat = 'weight_loss' THEN
    PERFORM public.queue_member_notification_payload(NEW.member_id, 'milestone_achieved', interval '1 hour', jsonb_build_object('milestone', v_name));
  ELSIF v_cat = 'weight_gain' THEN
    PERFORM public.queue_member_notification_payload(NEW.member_id, 'milestone_achieved_gain', interval '1 hour', jsonb_build_object('milestone', v_name));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.queue_wlp_checkin_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_date date;
BEGIN
  SELECT session_date INTO v_date FROM public.wlp_sessions WHERE id = NEW.session_id;
  PERFORM public.queue_member_notification_payload(NEW.member_id, 'wlp_checkin', interval '6 hours',
    jsonb_build_object('session_date', to_char(v_date, 'DD Mon YYYY')));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_queue_wlp_checkin ON public.wlp_checkins;
CREATE TRIGGER trg_queue_wlp_checkin AFTER INSERT ON public.wlp_checkins
  FOR EACH ROW EXECUTE FUNCTION public.queue_wlp_checkin_notification();

CREATE OR REPLACE FUNCTION public.queue_miw_registered_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record;
BEGIN
  SELECT name, fee, start_date, end_date INTO c FROM public.miw_challenges WHERE id = NEW.challenge_id;
  PERFORM public.queue_member_notification_payload(NEW.member_id, 'miw_registered', interval '1 day',
    jsonb_build_object('challenge_name', c.name, 'fee', to_char(c.fee, 'FM999,99,990'),
      'challenge_start', to_char(c.start_date, 'DD Mon YYYY'), 'challenge_end', to_char(c.end_date, 'DD Mon YYYY')));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_queue_miw_registered ON public.miw_participants;
CREATE TRIGGER trg_queue_miw_registered AFTER INSERT ON public.miw_participants
  FOR EACH ROW EXECUTE FUNCTION public.queue_miw_registered_notification();

CREATE OR REPLACE FUNCTION public.queue_pink_card_credit_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ref text;
BEGIN
  IF NEW.change > 0 AND NEW.referred_member_id IS NOT NULL THEN
    SELECT full_name INTO v_ref FROM public.wellness_members WHERE id = NEW.referred_member_id;
    PERFORM public.queue_member_notification_payload(NEW.member_id, 'pink_card_credit', interval '1 minute',
      jsonb_build_object('referred_name', coalesce(v_ref, ''), 'credits', NEW.change::text, 'pink_balance', NEW.balance_after::text));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_queue_pink_card_credit ON public.pink_card_ledger;
CREATE TRIGGER trg_queue_pink_card_credit AFTER INSERT ON public.pink_card_ledger
  FOR EACH ROW EXECUTE FUNCTION public.queue_pink_card_credit_notification();

REVOKE ALL ON FUNCTION public.queue_wlp_checkin_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_miw_registered_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_pink_card_credit_notification() FROM PUBLIC, anon, authenticated;