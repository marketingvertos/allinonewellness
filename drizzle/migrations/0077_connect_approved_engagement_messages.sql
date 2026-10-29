ALTER TABLE public.wellness_notification_log ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.wellness_notification_log ADD COLUMN IF NOT EXISTS lead_id uuid;

CREATE OR REPLACE FUNCTION public.queue_once(p_member uuid, p_lead uuid, p_trigger text, p_key text, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM wellness_notification_log WHERE dedupe_key = p_key) THEN RETURN; END IF;
  INSERT INTO wellness_notification_log(member_id, lead_id, trigger_key, channel, status, payload, dedupe_key)
  VALUES (p_member, p_lead, p_trigger, 'whatsapp', 'queued', coalesce(p_payload,'{}'::jsonb), p_key);
END $$;

-- Lead welcome
CREATE OR REPLACE FUNCTION public.trg_queue_lead_welcome() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM queue_once(NULL, NEW.id, 'lead_welcome', 'lead_welcome:' || NEW.id, '{}'::jsonb);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS queue_lead_welcome ON public.wellness_leads;
CREATE TRIGGER queue_lead_welcome AFTER INSERT ON public.wellness_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_queue_lead_welcome();

-- Ambassador / Supervisor title earned
CREATE OR REPLACE FUNCTION public.trg_queue_title_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY coalesce(NEW.tags,'{}') LOOP
    IF lower(t) IN ('ambassador','supervisor') AND NOT (t = ANY(coalesce(OLD.tags,'{}'))) THEN
      PERFORM queue_once(NEW.id, NULL, 'title_achieved',
        'title:' || NEW.id || ':' || lower(t) || ':' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY-MM'),
        jsonb_build_object('title_name', initcap(t), 'network_count', coalesce(NEW.network_total, NEW.frontline_count, 0)::text));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS queue_title_message ON public.wellness_members;
CREATE TRIGGER queue_title_message AFTER UPDATE OF tags ON public.wellness_members
FOR EACH ROW EXECUTE FUNCTION public.trg_queue_title_message();

-- Daily: Family Day, 26-day consistency, absent reminder, MIW start/midway/completed
CREATE OR REPLACE FUNCTION public.queue_daily_engagement_notifications() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_ms date := date_trunc('month', v_today)::date;
  v_mkey text := to_char(v_today,'YYYY-MM');
  v_mlabel text := trim(to_char(v_today,'Month YYYY'));
  r record; c record;
BEGIN
  -- Family Day: first vs latest weight this month
  FOR r IN
    SELECT m.id, m.goal::text goal,
      (SELECT weight FROM weight_tracking w WHERE w.member_id=m.id AND w.recorded_date BETWEEN v_ms AND v_today AND weight IS NOT NULL ORDER BY recorded_date, created_at LIMIT 1) fw,
      (SELECT weight FROM weight_tracking w WHERE w.member_id=m.id AND w.recorded_date BETWEEN v_ms AND v_today AND weight IS NOT NULL ORDER BY recorded_date DESC, created_at DESC LIMIT 1) lw
    FROM wellness_members m WHERE m.status IN ('active_member','renewal_due') AND m.goal IN ('weight_loss','weight_gain')
  LOOP
    IF r.fw IS NOT NULL AND r.lw IS NOT NULL AND (
       (r.goal='weight_loss' AND r.lw - r.fw <= -5) OR (r.goal='weight_gain' AND r.lw - r.fw >= 3)) THEN
      PERFORM queue_once(r.id, NULL, 'family_day_qualified', 'familyday:' || r.id || ':' || v_mkey,
        jsonb_build_object('family_day_month', v_mlabel,
          'month_change', to_char(r.lw - r.fw, 'SG990.0'),
          'month_goal', CASE WHEN r.goal='weight_loss' THEN 'lose 5 kg' ELSE 'gain 3 kg' END));
    END IF;
  END LOOP;

  -- 26-day consistency (club visits, packed servings excluded)
  FOR r IN
    SELECT a.member_id, count(DISTINCT a.visit_date) n FROM wellness_attendance a
    JOIN wellness_members m ON m.id=a.member_id AND m.status IN ('active_member','renewal_due')
    WHERE a.visit_date BETWEEN v_ms AND v_today AND a.checkin_method::text <> 'serving_issue'
    GROUP BY a.member_id HAVING count(DISTINCT a.visit_date) >= 26
  LOOP
    PERFORM queue_once(r.member_id, NULL, 'consistency_26', 'consistency:' || r.member_id || ':' || v_mkey,
      jsonb_build_object('active_days', r.n::text, 'month_label', v_mlabel));
  END LOOP;

  -- Absent 3 days with servings left
  FOR r IN
    SELECT ms.member_id, max(a.visit_date) lv, max(ms.remaining_servings) rem
    FROM wellness_memberships ms
    JOIN wellness_members m ON m.id=ms.member_id AND m.status='active_member'
    JOIN wellness_attendance a ON a.member_id=ms.member_id AND a.checkin_method::text <> 'serving_issue'
    WHERE ms.status IN ('active','expiring_soon') AND ms.remaining_servings > 0
    GROUP BY ms.member_id
    HAVING max(a.visit_date) = v_today - 3
  LOOP
    PERFORM queue_once(r.member_id, NULL, 'member_absent', 'absent:' || r.member_id || ':' || r.lv,
      jsonb_build_object('last_visit', to_char(r.lv,'DD Mon YYYY'), 'remaining', r.rem::text));
  END LOOP;

  -- MIW
  FOR c IN SELECT * FROM miw_challenges WHERE start_date - 1 <= v_today AND end_date + 1 >= v_today LOOP
    FOR r IN
      SELECT p.member_id,
        (SELECT count(DISTINCT visit_date) FROM wellness_attendance a WHERE a.member_id=p.member_id AND a.visit_date BETWEEN c.start_date AND least(v_today,c.end_date)) s,
        (SELECT weight FROM weight_tracking w WHERE w.member_id=p.member_id AND w.recorded_date BETWEEN c.start_date AND c.end_date AND weight IS NOT NULL ORDER BY recorded_date, created_at LIMIT 1) fw,
        (SELECT weight FROM weight_tracking w WHERE w.member_id=p.member_id AND w.recorded_date BETWEEN c.start_date AND least(v_today,c.end_date) AND weight IS NOT NULL ORDER BY recorded_date DESC, created_at DESC LIMIT 1) lw
      FROM miw_participants p WHERE p.challenge_id=c.id AND p.removed_at IS NULL
    LOOP
      IF v_today = c.start_date - 1 THEN
        PERFORM queue_once(r.member_id, NULL, 'miw_starts', 'miwstart:' || c.id || ':' || r.member_id,
          jsonb_build_object('miw_start', to_char(c.start_date,'DD Mon YYYY')));
      ELSIF v_today = c.start_date + 10 THEN
        PERFORM queue_once(r.member_id, NULL, 'miw_midway', 'miwmid:' || c.id || ':' || r.member_id,
          jsonb_build_object('miw_day','11','miw_sessions', r.s::text,
            'miw_change', coalesce(to_char(r.lw - r.fw,'SG990.0'),'0.0')));
      ELSIF v_today = c.end_date + 1 THEN
        PERFORM queue_once(r.member_id, NULL, 'miw_completed', 'miwdone:' || c.id || ':' || r.member_id,
          jsonb_build_object('miw_sessions', r.s::text,
            'miw_start_weight', coalesce(to_char(r.fw,'FM990.0'),'—'),
            'miw_final_weight', coalesce(to_char(r.lw,'FM990.0'),'—'),
            'miw_change', coalesce(to_char(r.lw - r.fw,'SG990.0'),'0.0')));
      END IF;
    END LOOP;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_daily_engagement_notifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_once(uuid, uuid, text, text, jsonb) FROM anon, authenticated;