CREATE OR REPLACE FUNCTION public.display_weight_changes(p_period text DEFAULT 'daily')
RETURNS TABLE (
  member_name text,
  goal text,
  initial_weight numeric,
  current_weight numeric,
  previous_weight numeric,
  change numeric,
  total_change numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_from date;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  IF p_period = 'weekly' THEN
    v_from := v_today - 7;
  ELSIF p_period = 'monthly' THEN
    v_from := v_today - 30;
  ELSE
    v_from := v_today - 1;
  END IF;

  RETURN QUERY
  SELECT
    m.full_name::text,
    COALESCE(m.goal::text, 'weight_loss'),
    COALESCE(m.initial_weight, 0),
    COALESCE(m.current_weight, 0),
    COALESCE(
      (SELECT wt.weight FROM weight_tracking wt
        WHERE wt.member_id = m.id AND wt.recorded_date <= v_from
        ORDER BY wt.recorded_date DESC, wt.created_at DESC LIMIT 1),
      m.initial_weight, 0),
    COALESCE(m.current_weight, 0) - COALESCE(
      (SELECT wt.weight FROM weight_tracking wt
        WHERE wt.member_id = m.id AND wt.recorded_date <= v_from
        ORDER BY wt.recorded_date DESC, wt.created_at DESC LIMIT 1),
      m.initial_weight, 0),
    COALESCE(m.current_weight, 0) - COALESCE(m.initial_weight, 0)
  FROM wellness_members m
  WHERE m.status IN ('active_member', 'renewal_due')
    AND m.current_weight IS NOT NULL
    AND m.initial_weight IS NOT NULL
    AND m.current_weight <> m.initial_weight
  ORDER BY
    CASE WHEN m.goal::text = 'weight_gain'
      THEN COALESCE(m.current_weight, 0) - COALESCE(m.initial_weight, 0)
      ELSE COALESCE(m.initial_weight, 0) - COALESCE(m.current_weight, 0)
    END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.display_weight_changes(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.display_milestone_achievers(p_category text DEFAULT 'weight_loss')
RETURNS TABLE (
  milestone_name text,
  milestone_threshold numeric,
  milestone_icon text,
  member_name text,
  total_change numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name::text,
    d.threshold,
    d.icon::text,
    m.full_name::text,
    CASE WHEN p_category = 'weight_gain'
      THEN COALESCE(m.current_weight, 0) - COALESCE(m.initial_weight, 0)
      ELSE COALESCE(m.initial_weight, 0) - COALESCE(m.current_weight, 0)
    END
  FROM member_achievements ma
  JOIN achievement_definitions d ON d.id = ma.achievement_id
  JOIN wellness_members m ON m.id = ma.member_id
  WHERE d.category = p_category
    AND d.is_active = true
  ORDER BY d.sort_order ASC, ma.unlocked_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.display_milestone_achievers(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.display_milestone_definitions(p_category text DEFAULT 'weight_loss')
RETURNS TABLE (
  name text,
  threshold numeric,
  icon text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.name::text, d.threshold, d.icon::text, d.sort_order
  FROM achievement_definitions d
  WHERE d.category = p_category AND d.is_active = true
  ORDER BY d.sort_order ASC, d.threshold ASC;
$$;

GRANT EXECUTE ON FUNCTION public.display_milestone_definitions(text) TO anon, authenticated;

INSERT INTO public.achievement_definitions (category, name, threshold, unit, icon, sort_order, is_active)
SELECT * FROM (VALUES
  ('weight_gain', '3 kg Gained', 3::numeric, 'kg', 'dumbbell', 1, true),
  ('weight_gain', '6 kg Gained', 6::numeric, 'kg', 'trophy', 2, true),
  ('weight_gain', '9 kg Gained', 9::numeric, 'kg', 'zap', 3, true),
  ('weight_gain', '12 kg Gained', 12::numeric, 'kg', 'flame', 4, true)
) AS v(category, name, threshold, unit, icon, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.achievement_definitions WHERE category = 'weight_gain');