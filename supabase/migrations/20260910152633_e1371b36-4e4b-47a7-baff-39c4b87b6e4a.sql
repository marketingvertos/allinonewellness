-- 1. Monthly activity table
CREATE TABLE public.coach_monthly_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  month text NOT NULL,
  new_memberships integer NOT NULL DEFAULT 0,
  required_memberships integer NOT NULL DEFAULT 1,
  met_requirement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, month)
);

CREATE INDEX idx_coach_monthly_activity_coach ON public.coach_monthly_activity(coach_id);
CREATE INDEX idx_coach_monthly_activity_month ON public.coach_monthly_activity(month);

GRANT SELECT ON public.coach_monthly_activity TO authenticated;
GRANT ALL ON public.coach_monthly_activity TO service_role;

ALTER TABLE public.coach_monthly_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and owner can view coach activity"
ON public.coach_monthly_activity FOR SELECT TO authenticated
USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), coach_id));

CREATE TRIGGER update_coach_monthly_activity_updated_at
BEFORE UPDATE ON public.coach_monthly_activity
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Downgrade bookkeeping on members
ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS last_title_downgrade_month text;

-- 3. Trigger: track new frontline memberships per coach per IST month
CREATE OR REPLACE FUNCTION public.track_coach_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
  v_month text;
  v_level integer;
  v_required integer;
BEGIN
  SELECT referred_by_member_id INTO v_coach_id
  FROM public.wellness_members WHERE id = NEW.member_id;

  IF v_coach_id IS NULL THEN RETURN NEW; END IF;

  v_month := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM');

  SELECT COALESCE(MAX(d.sort_order), 0) INTO v_level
  FROM public.member_achievements ma
  JOIN public.achievement_definitions d ON d.id = ma.achievement_id
  WHERE ma.member_id = v_coach_id AND d.category = 'referral';

  v_required := CASE WHEN v_level > 4 THEN 2 ELSE 1 END;

  INSERT INTO public.coach_monthly_activity (coach_id, month, new_memberships, required_memberships, met_requirement)
  VALUES (v_coach_id, v_month, 1, v_required, (1 >= v_required))
  ON CONFLICT (coach_id, month) DO UPDATE SET
    new_memberships = coach_monthly_activity.new_memberships + 1,
    required_memberships = v_required,
    met_requirement = (coach_monthly_activity.new_memberships + 1 >= v_required),
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_coach_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_coach_frontline_activity ON public.wellness_memberships;
CREATE TRIGGER track_coach_frontline_activity
AFTER INSERT ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.track_coach_activity();

-- 4. Rewritten recalc with active requirements
CREATE OR REPLACE FUNCTION public.recalc_member_achievements(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_referrals integer;
  v_start numeric;
  v_current numeric;
  v_delta numeric;
  v_direction text;
  v_category text;
  v_own_active boolean;
  v_last_month text;
  v_met boolean;
  v_highest_sort integer;
BEGIN
  SELECT * INTO v_member FROM public.wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- ===== Coach (referral) titles: conditional + reversible =====
  v_own_active := (v_member.status IN ('active_member', 'renewal_due'));

  IF NOT v_own_active THEN
    DELETE FROM public.member_achievements ma
    USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id
      AND ma.member_id = p_member_id
      AND d.category = 'referral';
  ELSE
    SELECT count(*) INTO v_referrals FROM public.wellness_members
     WHERE referred_by_member_id = p_member_id
       AND status IN ('active_member', 'renewal_due');

    v_last_month := to_char(
      (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day'), 'YYYY-MM');

    SELECT met_requirement INTO v_met
    FROM public.coach_monthly_activity
    WHERE coach_id = p_member_id AND month = v_last_month;

    -- Apply at most one downgrade per missed month
    IF v_met IS DISTINCT FROM true
       AND COALESCE(v_member.last_title_downgrade_month, '') <> v_last_month THEN
      SELECT MAX(d.sort_order) INTO v_highest_sort
      FROM public.member_achievements ma
      JOIN public.achievement_definitions d ON d.id = ma.achievement_id
      WHERE ma.member_id = p_member_id AND d.category = 'referral';

      IF v_highest_sort IS NOT NULL THEN
        DELETE FROM public.member_achievements ma
        USING public.achievement_definitions d
        WHERE ma.achievement_id = d.id
          AND ma.member_id = p_member_id
          AND d.category = 'referral'
          AND d.sort_order = v_highest_sort;

        UPDATE public.wellness_members
           SET last_title_downgrade_month = v_last_month
         WHERE id = p_member_id;

        v_member.last_title_downgrade_month := v_last_month;
      END IF;
    END IF;

    -- Remove titles no longer supported by the active frontline count
    DELETE FROM public.member_achievements ma
    USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id
      AND ma.member_id = p_member_id
      AND d.category = 'referral'
      AND v_referrals < d.threshold;

    -- Grant newly qualified titles, but never re-grant a level stripped this month
    INSERT INTO public.member_achievements(member_id, achievement_id)
    SELECT p_member_id, d.id FROM public.achievement_definitions d
     WHERE d.category = 'referral' AND d.is_active AND v_referrals >= d.threshold
       AND NOT (
         COALESCE(v_member.last_title_downgrade_month, '') = v_last_month
         AND v_met IS DISTINCT FROM true
         AND d.sort_order >= COALESCE(v_highest_sort, 2147483647)
       )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===== Weight milestones: unchanged, permanent =====
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

  IF v_direction = 'gain' THEN
    v_category := 'weight_gain';
    v_delta := v_current - v_start;
  ELSE
    v_category := 'weight_loss';
    v_delta := v_start - v_current;
  END IF;

  IF v_delta <= 0 THEN RETURN; END IF;

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = v_category AND d.is_active AND v_delta >= d.threshold
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_member_achievements(uuid) FROM PUBLIC, anon, authenticated;

-- 5. Monthly sweep for all title holders
CREATE OR REPLACE FUNCTION public.monthly_coach_title_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ma.member_id
    FROM public.member_achievements ma
    JOIN public.achievement_definitions d ON d.id = ma.achievement_id
    WHERE d.category = 'referral'
  LOOP
    PERFORM public.recalc_member_achievements(r.member_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.monthly_coach_title_check() FROM PUBLIC, anon, authenticated;

-- 6. Backfill monthly activity from existing memberships
INSERT INTO public.coach_monthly_activity (coach_id, month, new_memberships, required_memberships, met_requirement)
SELECT m.referred_by_member_id,
       to_char(ms.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
       count(*)::int,
       1,
       true
FROM public.wellness_memberships ms
JOIN public.wellness_members m ON m.id = ms.member_id
WHERE m.referred_by_member_id IS NOT NULL
GROUP BY 1, 2
ON CONFLICT (coach_id, month) DO NOTHING;

-- 7. Recalculate everyone under the new rules
DO $do$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.wellness_members LOOP
    PERFORM public.recalc_member_achievements(r.id);
  END LOOP;
END;
$do$;