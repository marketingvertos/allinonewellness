-- 1. Idempotent template keys
CREATE UNIQUE INDEX IF NOT EXISTS wellness_notification_templates_trigger_channel_key
  ON public.wellness_notification_templates (trigger_key, channel);

-- 2. Shared queue helper with dedupe
CREATE OR REPLACE FUNCTION public.queue_member_notification(
  p_member_id uuid,
  p_trigger text,
  p_dedupe interval DEFAULT interval '12 hours'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_member_id IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.wellness_notification_log
    WHERE member_id = p_member_id
      AND trigger_key = p_trigger
      AND created_at > now() - p_dedupe
  ) THEN RETURN; END IF;

  INSERT INTO public.wellness_notification_log (member_id, trigger_key, channel, status)
  VALUES (p_member_id, p_trigger, 'whatsapp', 'queued');
END;
$$;
REVOKE ALL ON FUNCTION public.queue_member_notification(uuid, text, interval) FROM anon, authenticated;

-- 3. Serving-driven lifecycle
CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  r record;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;

  -- servings reach zero: start the 10 day renewal window
  UPDATE wellness_memberships SET servings_exhausted_on = v_today
    WHERE status IN ('active','expiring_soon') AND remaining_servings <= 0 AND servings_exhausted_on IS NULL;

  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND remaining_servings <= 0;

  -- after the 10 day window the membership is expired
  FOR r IN
    UPDATE wellness_memberships SET status = 'expired'
      WHERE status IN ('active','expiring_soon')
        AND remaining_servings <= 0
        AND servings_exhausted_on IS NOT NULL
        AND servings_exhausted_on < v_today - 10
      RETURNING member_id
  LOOP
    PERFORM public.queue_member_notification(r.member_id, 'membership_expired', interval '30 days');
  END LOOP;

  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));

  UPDATE wellness_members m SET status = 'active_member'
    WHERE m.status = 'expired'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon','queued'));

  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END;
$$;

-- 4. Event triggers
CREATE OR REPLACE FUNCTION public.queue_member_created_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.is_guest, false) THEN RETURN NEW; END IF;
  PERFORM public.queue_member_notification(NEW.id, 'member_created', interval '365 days');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_member_created ON public.wellness_members;
CREATE TRIGGER queue_member_created AFTER INSERT ON public.wellness_members
  FOR EACH ROW EXECUTE FUNCTION public.queue_member_created_notification();

CREATE OR REPLACE FUNCTION public.queue_trial_started_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.queue_member_notification(NEW.member_id, 'trial_started', interval '2 days');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_trial_started ON public.wellness_trials;
CREATE TRIGGER queue_trial_started AFTER INSERT ON public.wellness_trials
  FOR EACH ROW EXECUTE FUNCTION public.queue_trial_started_notification();

CREATE OR REPLACE FUNCTION public.queue_milestone_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cat text;
BEGIN
  SELECT category INTO v_cat FROM public.achievement_definitions WHERE id = NEW.achievement_id;
  IF v_cat IN ('weight_loss','weight_gain') THEN
    PERFORM public.queue_member_notification(NEW.member_id, 'milestone_achieved', interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_milestone_achieved ON public.member_achievements;
CREATE TRIGGER queue_milestone_achieved AFTER INSERT ON public.member_achievements
  FOR EACH ROW EXECUTE FUNCTION public.queue_milestone_notification();

CREATE OR REPLACE FUNCTION public.queue_checkin_rejected_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.queue_member_notification(NEW.member_id, 'checkin_rejected', interval '1 hour');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_checkin_rejected ON public.wellness_checkin_requests;
CREATE TRIGGER queue_checkin_rejected AFTER UPDATE ON public.wellness_checkin_requests
  FOR EACH ROW EXECUTE FUNCTION public.queue_checkin_rejected_notification();

CREATE OR REPLACE FUNCTION public.queue_servings_issued_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.txn_type = 'pack_and_issue' THEN
    PERFORM public.queue_member_notification(NEW.member_id, 'servings_issued', interval '1 minute');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_servings_issued ON public.serving_transactions;
CREATE TRIGGER queue_servings_issued AFTER INSERT ON public.serving_transactions
  FOR EACH ROW EXECUTE FUNCTION public.queue_servings_issued_notification();

CREATE OR REPLACE FUNCTION public.queue_payment_received_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.queue_member_notification(NEW.member_id, 'payment_received', interval '1 minute');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_payment_received ON public.wellness_payments;
CREATE TRIGGER queue_payment_received AFTER INSERT ON public.wellness_payments
  FOR EACH ROW EXECUTE FUNCTION public.queue_payment_received_notification();

-- 5. Plan switch queues its own message
CREATE OR REPLACE FUNCTION public.switch_membership_plan(p_membership_id uuid, p_new_plan_id uuid, p_carry_servings boolean DEFAULT true, p_price numeric DEFAULT NULL::numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old record; v_plan record; v_new_id uuid; v_code text; v_total integer;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_new_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_total := v_plan.total_servings + CASE WHEN p_carry_servings THEN GREATEST(v_old.remaining_servings,0) ELSE 0 END;
  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

  IF p_carry_servings THEN
    UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;
  ELSIF v_old.remaining_servings > 0 THEN
    UPDATE wellness_memberships SET status = 'queued' WHERE id = p_membership_id;
  ELSE
    UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;
  END IF;

  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by)
  VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
    v_total, 0, v_total, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_new_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_old.member_id, v_new_id, 'membership_allocation', v_total, v_total, auth.uid(),
    CASE WHEN p_carry_servings THEN 'Plan switched (carried leftover servings)' ELSE 'Plan switched (previous balance queued)' END);

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  PERFORM public.queue_member_notification(v_old.member_id, 'plan_switched', interval '1 minute');
  RETURN v_new_id;
END; $$;

-- 6. Daily queue functions
CREATE OR REPLACE FUNCTION public.queue_birthday_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r record;
BEGIN
  FOR r IN
    SELECT id FROM wellness_members
    WHERE date_of_birth IS NOT NULL
      AND COALESCE(is_guest,false) = false
      AND status <> 'inactive'
      AND to_char(date_of_birth,'MM-DD') = to_char(v_today,'MM-DD')
  LOOP
    PERFORM public.queue_member_notification(r.id, 'birthday', interval '300 days');
  END LOOP;

  FOR r IN
    SELECT id FROM wellness_members
    WHERE anniversary_date IS NOT NULL
      AND COALESCE(is_guest,false) = false
      AND status <> 'inactive'
      AND to_char(anniversary_date,'MM-DD') = to_char(v_today,'MM-DD')
  LOOP
    PERFORM public.queue_member_notification(r.id, 'anniversary', interval '300 days');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_birthday_notifications() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_trial_ending_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r record;
BEGIN
  FOR r IN
    SELECT member_id FROM wellness_trials
    WHERE status = 'active' AND end_date = v_today + 1
  LOOP
    PERFORM public.queue_member_notification(r.member_id, 'trial_ending', interval '2 days');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_trial_ending_notifications() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_renewal_reminder_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r record;
BEGIN
  FOR r IN
    SELECT member_id FROM wellness_memberships
    WHERE status IN ('active','expiring_soon')
      AND remaining_servings <= 0
      AND servings_exhausted_on = v_today - 7
  LOOP
    PERFORM public.queue_member_notification(r.member_id, 'renewal_reminder', interval '5 days');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_renewal_reminder_notifications() FROM anon, authenticated;
