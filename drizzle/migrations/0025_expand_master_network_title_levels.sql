CREATE OR REPLACE FUNCTION public.recalc_network_counts(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fl integer;
  v_tot integer;
BEGIN
  WITH RECURSIVE net AS (
    SELECT wm.id, 1 AS depth
    FROM public.wellness_members wm
    WHERE wm.referred_by_member_id = p_member_id
    UNION ALL
    SELECT wm.id, n.depth + 1
    FROM public.wellness_members wm
    INNER JOIN net n ON wm.referred_by_member_id = n.id
    WHERE n.depth < 20
  )
  SELECT COUNT(*) FILTER (WHERE depth = 1)::integer, COUNT(*)::integer
  INTO v_fl, v_tot
  FROM net;

  v_fl := COALESCE(v_fl, 0);
  v_tot := COALESCE(v_tot, 0);

  UPDATE public.wellness_members SET
    frontline_count = v_fl,
    cluster_count = v_tot - v_fl,
    network_total = v_tot,
    master_level = CASE
      WHEN v_tot >= 100 THEN 100
      WHEN v_tot >= 90 THEN 90
      WHEN v_tot >= 80 THEN 80
      WHEN v_tot >= 70 THEN 70
      WHEN v_tot >= 60 THEN 60
      WHEN v_tot >= 50 THEN 50
      WHEN v_tot >= 40 THEN 40
      WHEN v_tot >= 30 THEN 30
      WHEN v_tot >= 20 THEN 20
      WHEN v_tot >= 15 THEN 15
      WHEN v_tot >= 10 THEN 10
      ELSE 0
    END
  WHERE id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_network_counts(uuid) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.get_network_summary(member_ids uuid[])
RETURNS TABLE (
  root_id uuid,
  frontline_count integer,
  cluster_count integer,
  total_count integer,
  master_level integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    s.root_id,
    s.frontline_count,
    (s.total_count - s.frontline_count) AS cluster_count,
    s.total_count,
    CASE
      WHEN s.total_count >= 100 THEN 100
      WHEN s.total_count >= 90 THEN 90
      WHEN s.total_count >= 80 THEN 80
      WHEN s.total_count >= 70 THEN 70
      WHEN s.total_count >= 60 THEN 60
      WHEN s.total_count >= 50 THEN 50
      WHEN s.total_count >= 40 THEN 40
      WHEN s.total_count >= 30 THEN 30
      WHEN s.total_count >= 20 THEN 20
      WHEN s.total_count >= 15 THEN 15
      WHEN s.total_count >= 10 THEN 10
      ELSE 0
    END AS master_level
  FROM (
    SELECT
      rid AS root_id,
      COUNT(*) FILTER (WHERE sub.depth = 1)::integer AS frontline_count,
      COUNT(sub.depth)::integer AS total_count
    FROM unnest(member_ids) AS rid
    LEFT JOIN LATERAL (
      WITH RECURSIVE net AS (
        SELECT wm.id, 1 AS depth
        FROM public.wellness_members wm
        WHERE wm.referred_by_member_id = rid
        UNION ALL
        SELECT wm.id, n.depth + 1
        FROM public.wellness_members wm
        INNER JOIN net n ON wm.referred_by_member_id = n.id
        WHERE n.depth < 20
      )
      SELECT depth FROM net
    ) sub ON true
    GROUP BY rid
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.get_network_summary(uuid[]) TO authenticated;