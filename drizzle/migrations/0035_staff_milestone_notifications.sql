ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uidx ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_staff(p_type text, p_title text, p_message text, p_ref_id uuid, p_ref_type text, p_dedupe_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications(user_id, type, title, message, reference_id, reference_type, dedupe_key)
  SELECT DISTINCT ur.user_id, p_type, p_title, p_message, p_ref_id, p_ref_type, p_dedupe_key
  FROM user_roles ur
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_staff(text,text,text,uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_achievement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_ach text; v_icon text;
BEGIN
  SELECT full_name INTO v_name FROM wellness_members WHERE id = NEW.member_id;
  SELECT name, icon INTO v_ach, v_icon FROM achievement_definitions WHERE id = NEW.achievement_id;
  PERFORM notify_staff('milestone', coalesce(v_icon || ' ','') || coalesce(v_name,'Member') || ' unlocked ' || coalesce(v_ach,'a milestone'),
    NULL, NEW.member_id, 'member', 'ach:' || NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_achievement ON public.member_achievements;
CREATE TRIGGER notify_achievement AFTER INSERT ON public.member_achievements FOR EACH ROW EXECUTE FUNCTION public.trg_notify_achievement();

CREATE OR REPLACE FUNCTION public.trg_notify_reward() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM wellness_members WHERE id = NEW.member_id;
  PERFORM notify_staff('reward', coalesce(v_name,'Member') || ' earned a ' || replace(NEW.reward_type,'_',' ') || ' reward',
    'Month ' || NEW.month, NEW.member_id, 'reward:' || NEW.month, 'rew:' || NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_reward ON public.wellness_monthly_rewards;
CREATE TRIGGER notify_reward AFTER INSERT ON public.wellness_monthly_rewards FOR EACH ROW EXECUTE FUNCTION public.trg_notify_reward();

CREATE OR REPLACE FUNCTION public.trg_notify_weight_month() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month text := to_char(NEW.recorded_date,'YYYY-MM'); v_first numeric; v_last numeric; v_goal text; v_name text; v_diff numeric;
BEGIN
  SELECT goal::text, full_name INTO v_goal, v_name FROM wellness_members WHERE id = NEW.member_id;
  SELECT weight INTO v_first FROM weight_tracking WHERE member_id = NEW.member_id AND to_char(recorded_date,'YYYY-MM') = v_month ORDER BY recorded_date, created_at LIMIT 1;
  SELECT weight INTO v_last FROM weight_tracking WHERE member_id = NEW.member_id AND to_char(recorded_date,'YYYY-MM') = v_month ORDER BY recorded_date DESC, created_at DESC LIMIT 1;
  IF v_first IS NULL OR v_last IS NULL THEN RETURN NEW; END IF;
  v_diff := round(v_last - v_first, 1);
  IF coalesce(v_goal,'weight_loss') <> 'weight_gain' AND v_diff <= -5 THEN
    PERFORM notify_staff('weight', coalesce(v_name,'Member') || ' lost ' || abs(v_diff) || ' kg this month', 'Month ' || v_month || ' · Family Day reward', NEW.member_id, 'weight:' || v_month, 'weight:' || NEW.member_id || ':' || v_month);
  ELSIF v_goal = 'weight_gain' AND v_diff >= 3 THEN
    PERFORM notify_staff('weight', coalesce(v_name,'Member') || ' gained ' || v_diff || ' kg this month', 'Month ' || v_month || ' · Family Day reward', NEW.member_id, 'weight:' || v_month, 'weight:' || NEW.member_id || ':' || v_month);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_weight_month ON public.weight_tracking;
CREATE TRIGGER notify_weight_month AFTER INSERT OR UPDATE OF weight, recorded_date ON public.weight_tracking FOR EACH ROW EXECUTE FUNCTION public.trg_notify_weight_month();

CREATE OR REPLACE FUNCTION public.trg_notify_title() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF coalesce(NEW.master_level,0) > coalesce(OLD.master_level,0) AND 'supervisor' = ANY(NEW.tags) THEN
    PERFORM notify_staff('title', NEW.full_name || ' reached Master ' || NEW.master_level, NULL, NEW.id, 'member', 'master:' || NEW.id || ':' || NEW.master_level);
  END IF;
  FOREACH t IN ARRAY coalesce(NEW.tags, '{}') LOOP
    IF lower(t) IN ('supervisor','ambassador','coach','world_team','active_world_team','get_team','millionaire_team','presidents_team')
       AND NOT (t = ANY(coalesce(OLD.tags,'{}'))) THEN
      PERFORM notify_staff('title', NEW.full_name || ' qualified as ' || initcap(replace(t,'_',' ')), NULL, NEW.id, 'member', 'tag:' || NEW.id || ':' || t || ':' || to_char(now(),'YYYY-MM'));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_title ON public.wellness_members;
CREATE TRIGGER notify_title AFTER UPDATE OF master_level, tags ON public.wellness_members FOR EACH ROW EXECUTE FUNCTION public.trg_notify_title();

CREATE OR REPLACE FUNCTION public.queue_birthday_notifications()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; r record;
BEGIN
  FOR r IN
    SELECT id, full_name FROM wellness_members
    WHERE date_of_birth IS NOT NULL AND COALESCE(is_guest,false) = false AND status <> 'inactive'
      AND to_char(date_of_birth,'MM-DD') = to_char(v_today,'MM-DD')
  LOOP
    PERFORM public.queue_member_notification(r.id, 'birthday', interval '300 days');
    PERFORM public.notify_staff('birthday', '🎂 ' || r.full_name || '''s birthday is today', NULL, r.id, 'member', 'bday:' || r.id || ':' || v_today);
  END LOOP;

  FOR r IN
    SELECT id FROM wellness_members
    WHERE anniversary_date IS NOT NULL AND COALESCE(is_guest,false) = false AND status <> 'inactive'
      AND to_char(anniversary_date,'MM-DD') = to_char(v_today,'MM-DD')
  LOOP
    PERFORM public.queue_member_notification(r.id, 'anniversary', interval '300 days');
  END LOOP;
END;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;