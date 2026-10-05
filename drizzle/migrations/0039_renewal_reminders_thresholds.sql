ALTER TABLE public.wellness_notification_log ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wellness_notification_log_dedupe ON public.wellness_notification_log(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.queue_serving_threshold_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_threshold int; v_plan record;
BEGIN
  IF NEW.remaining_servings IS NULL OR OLD.remaining_servings IS NULL
     OR NEW.remaining_servings >= OLD.remaining_servings THEN
    RETURN NEW;
  END IF;

  SELECT min(t) INTO v_threshold FROM unnest(ARRAY[7,5,3,2,1,0]) t
   WHERE t < OLD.remaining_servings AND t >= NEW.remaining_servings;
  IF v_threshold IS NULL THEN RETURN NEW; END IF;

  SELECT plan_type, duration_days INTO v_plan FROM wellness_plans WHERE id = NEW.plan_id;
  IF v_plan.plan_type = 'trial' OR coalesce(v_plan.duration_days, 0) <= 1 THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM wellness_memberships o
             WHERE o.member_id = NEW.member_id AND o.id <> NEW.id
               AND o.status IN ('queued','active','expiring_soon')
               AND o.created_at > NEW.created_at) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wellness_notification_log(member_id, trigger_key, channel, dedupe_key)
  VALUES (NEW.member_id, 'serving_balance_' || v_threshold::text, 'whatsapp',
          'serving_balance_' || v_threshold::text || ':' || NEW.id::text)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_serving_threshold_notification() FROM anon, authenticated, public;