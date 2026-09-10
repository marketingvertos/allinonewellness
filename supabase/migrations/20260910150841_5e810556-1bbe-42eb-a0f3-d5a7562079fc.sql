ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS frontline_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cluster_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS master_level integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wellness_members_referred_by
  ON public.wellness_members (referred_by_member_id);

-- Recompute stored counts for one member
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
      WHEN v_tot >= 50 THEN 50
      WHEN v_tot >= 40 THEN 40
      WHEN v_tot >= 30 THEN 30
      WHEN v_tot >= 20 THEN 20
      WHEN v_tot >= 10 THEN 10
      ELSE 0
    END
  WHERE id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_network_counts(uuid) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.refresh_network_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a uuid;
  guard integer;
BEGIN
  IF NEW.referred_by_member_id IS NOT NULL THEN
    a := NEW.referred_by_member_id;
    guard := 0;
    WHILE a IS NOT NULL AND guard < 20 LOOP
      PERFORM public.recalc_network_counts(a);
      SELECT referred_by_member_id INTO a FROM public.wellness_members WHERE id = a;
      guard := guard + 1;
    END LOOP;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.referred_by_member_id IS DISTINCT FROM NEW.referred_by_member_id
     AND OLD.referred_by_member_id IS NOT NULL THEN
    a := OLD.referred_by_member_id;
    guard := 0;
    WHILE a IS NOT NULL AND guard < 20 LOOP
      PERFORM public.recalc_network_counts(a);
      SELECT referred_by_member_id INTO a FROM public.wellness_members WHERE id = a;
      guard := guard + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_network_counts() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_refresh_network_counts ON public.wellness_members;
CREATE TRIGGER trg_refresh_network_counts
  AFTER INSERT OR UPDATE OF referred_by_member_id ON public.wellness_members
  FOR EACH ROW EXECUTE FUNCTION public.refresh_network_counts();

-- Full downstream tree for one member
CREATE OR REPLACE FUNCTION public.get_referral_network(root_member_id uuid)
RETURNS TABLE (
  member_id uuid,
  full_name text,
  mobile_number text,
  status text,
  depth integer,
  referred_by uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE network AS (
    SELECT wm.id AS member_id, wm.full_name, wm.mobile_number, wm.status::text,
           1 AS depth, wm.referred_by_member_id AS referred_by
    FROM public.wellness_members wm
    WHERE wm.referred_by_member_id = root_member_id
    UNION ALL
    SELECT wm.id, wm.full_name, wm.mobile_number, wm.status::text,
           n.depth + 1, wm.referred_by_member_id
    FROM public.wellness_members wm
    INNER JOIN network n ON wm.referred_by_member_id = n.member_id
    WHERE n.depth < 20
  )
  SELECT * FROM network ORDER BY depth, full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_network(uuid) TO authenticated;

-- Batch counts
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
      WHEN s.total_count >= 50 THEN 50
      WHEN s.total_count >= 40 THEN 40
      WHEN s.total_count >= 30 THEN 30
      WHEN s.total_count >= 20 THEN 20
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

-- One-time backfill
DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT id FROM public.wellness_members LOOP
    PERFORM public.recalc_network_counts(m.id);
  END LOOP;
END;
$$;