-- Shared "counts this month" definition (same as Master titles): member_active_in_month(member, ist_month())

CREATE OR REPLACE FUNCTION public.coach_new_frontline(p_member_id uuid, p_month text)
RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COUNT(DISTINCT wm.id)::integer
  FROM public.wellness_members wm
  JOIN public.wellness_memberships m ON m.member_id = wm.id AND m.renewed_from IS NULL
  JOIN public.wellness_plans p ON p.id = m.plan_id AND p.plan_type = 'membership'
    AND p.total_servings = 30 AND p.duration_days = 30
  WHERE wm.referred_by_member_id = p_member_id
    AND m.status IN ('active','expiring_soon','queued')
    AND to_char(COALESCE(m.payment_date, m.start_date), 'YYYY-MM') = p_month
$$;

CREATE OR REPLACE FUNCTION public.refresh_coach_activity(p_coach_id uuid, p_month text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_level integer; v_required integer; v_done integer;
BEGIN
  SELECT COALESCE(MAX(d.sort_order), 0) INTO v_level
  FROM public.member_achievements ma JOIN public.achievement_definitions d ON d.id = ma.achievement_id
  WHERE ma.member_id = p_coach_id AND d.category = 'referral';
  v_required := CASE WHEN v_level > 4 THEN 2 ELSE 1 END;
  v_done := public.coach_new_frontline(p_coach_id, p_month);
  INSERT INTO public.coach_monthly_activity (coach_id, month, new_memberships, required_memberships, met_requirement)
  VALUES (p_coach_id, p_month, v_done, v_required, v_done >= v_required)
  ON CONFLICT (coach_id, month) DO UPDATE SET
    new_memberships = EXCLUDED.new_memberships,
    required_memberships = EXCLUDED.required_memberships,
    met_requirement = EXCLUDED.met_requirement,
    updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.track_coach_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_coach_id uuid;
BEGIN
  SELECT referred_by_member_id INTO v_coach_id FROM public.wellness_members WHERE id = NEW.member_id;
  PERFORM public.recalc_member_achievements(NEW.member_id);
  IF v_coach_id IS NOT NULL THEN
    PERFORM public.refresh_coach_activity(v_coach_id, public.ist_month());
    PERFORM public.recalc_member_achievements(v_coach_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS track_coach_frontline_activity ON public.wellness_memberships;
CREATE TRIGGER track_coach_frontline_activity
AFTER INSERT OR UPDATE OF status, plan_id, start_date, payment_date ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.track_coach_activity();

CREATE OR REPLACE FUNCTION public.recalc_member_achievements(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_member record; v_referrals integer; v_start numeric; v_current numeric; v_delta numeric;
  v_direction text; v_category text; v_own_active boolean; v_last_month text; v_met boolean;
  v_highest_sort integer; v_month text;
BEGIN
  SELECT * INTO v_member FROM public.wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_month := public.ist_month();

  -- Coach must hold an active UMS 30 activated/renewed this IST month
  v_own_active := public.member_active_in_month(p_member_id, v_month);

  IF NOT v_own_active THEN
    DELETE FROM public.member_achievements ma USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id AND ma.member_id = p_member_id AND d.category = 'referral';
  ELSE
    SELECT count(*) INTO v_referrals FROM public.wellness_members r
     WHERE r.referred_by_member_id = p_member_id
       AND public.member_active_in_month(r.id, v_month);

    v_last_month := to_char((date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day'), 'YYYY-MM');
    SELECT met_requirement INTO v_met FROM public.coach_monthly_activity
    WHERE coach_id = p_member_id AND month = v_last_month;

    IF v_met IS DISTINCT FROM true AND COALESCE(v_member.last_title_downgrade_month, '') <> v_last_month THEN
      SELECT MAX(d.sort_order) INTO v_highest_sort FROM public.member_achievements ma
      JOIN public.achievement_definitions d ON d.id = ma.achievement_id
      WHERE ma.member_id = p_member_id AND d.category = 'referral';
      IF v_highest_sort IS NOT NULL THEN
        DELETE FROM public.member_achievements ma USING public.achievement_definitions d
        WHERE ma.achievement_id = d.id AND ma.member_id = p_member_id
          AND d.category = 'referral' AND d.sort_order = v_highest_sort;
        UPDATE public.wellness_members SET last_title_downgrade_month = v_last_month WHERE id = p_member_id;
        v_member.last_title_downgrade_month := v_last_month;
      END IF;
    END IF;

    DELETE FROM public.member_achievements ma USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id AND ma.member_id = p_member_id
      AND d.category = 'referral' AND v_referrals < d.threshold;

    INSERT INTO public.member_achievements(member_id, achievement_id)
    SELECT p_member_id, d.id FROM public.achievement_definitions d
     WHERE d.category = 'referral' AND d.is_active AND v_referrals >= d.threshold
       AND NOT (COALESCE(v_member.last_title_downgrade_month, '') = v_last_month
                AND v_met IS DISTINCT FROM true
                AND d.sort_order >= COALESCE(v_highest_sort, 2147483647))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Weight milestones (unchanged)
  v_start := COALESCE(v_member.initial_weight,
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date ASC, w.created_at ASC LIMIT 1));
  v_current := COALESCE(
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date DESC, w.created_at DESC LIMIT 1),
    v_member.current_weight);
  IF v_start IS NULL OR v_current IS NULL THEN RETURN; END IF;
  SELECT c.direction INTO v_direction FROM public.member_categories c WHERE c.id = v_member.category_id;
  IF v_direction IS NULL THEN
    v_direction := CASE WHEN v_member.goal = 'weight_gain' THEN 'gain' ELSE 'loss' END;
  END IF;
  IF v_direction = 'gain' THEN v_category := 'weight_gain'; v_delta := v_current - v_start;
  ELSE v_category := 'weight_loss'; v_delta := v_start - v_current; END IF;
  DELETE FROM public.member_achievements ma USING public.achievement_definitions d
  WHERE ma.achievement_id = d.id AND ma.member_id = p_member_id
    AND d.category IN ('weight_loss','weight_gain') AND d.category <> v_category;
  DELETE FROM public.member_achievements ma USING public.achievement_definitions d
  WHERE ma.achievement_id = d.id AND ma.member_id = p_member_id
    AND d.category = v_category AND v_delta < d.threshold;
  IF v_delta <= 0 THEN RETURN; END IF;
  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = v_category AND d.is_active AND v_delta >= d.threshold
  ON CONFLICT DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.daily_coach_title_check()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_month text := public.ist_month();
BEGIN
  FOR r IN
    SELECT DISTINCT referred_by_member_id AS id FROM public.wellness_members WHERE referred_by_member_id IS NOT NULL
    UNION
    SELECT DISTINCT ma.member_id FROM public.member_achievements ma
    JOIN public.achievement_definitions d ON d.id = ma.achievement_id WHERE d.category = 'referral'
  LOOP
    PERFORM public.refresh_coach_activity(r.id, v_month);
    PERFORM public.recalc_member_achievements(r.id);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.monthly_coach_title_check()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.daily_coach_title_check(); $$;

CREATE OR REPLACE FUNCTION public.get_coach_title_status(p_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_month text := public.ist_month();
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  RETURN jsonb_build_object(
    'month', v_month,
    'own_qualified', public.member_active_in_month(p_member_id, v_month),
    'counts_for_referrer', public.member_active_in_month(p_member_id, v_month),
    'active_frontline_ids', COALESCE((SELECT jsonb_agg(r.id) FROM public.wellness_members r
        WHERE r.referred_by_member_id = p_member_id AND public.member_active_in_month(r.id, v_month)), '[]'::jsonb),
    'new_frontline', public.coach_new_frontline(p_member_id, v_month)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_coach_title_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_coach_title_check() TO service_role;

-- Backfill this month and recalc everyone
DO $$ DECLARE r record; BEGIN
  PERFORM public.daily_coach_title_check();
  FOR r IN SELECT id FROM public.wellness_members LOOP
    PERFORM public.recalc_member_achievements(r.id);
  END LOOP;
END $$;