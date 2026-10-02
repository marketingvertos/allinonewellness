CREATE OR REPLACE FUNCTION public.ist_month()
 RETURNS text LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$ SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') $function$;

CREATE OR REPLACE FUNCTION public.member_active_in_month(p_member_id uuid, p_month text)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.wellness_memberships m
    JOIN public.wellness_plans p ON p.id = m.plan_id
    WHERE m.member_id = p_member_id
      AND p.plan_type = 'membership'
      AND m.status <> 'cancelled'
      AND to_char(COALESCE(m.payment_date, m.start_date), 'YYYY-MM') = p_month
  )
$function$;

CREATE OR REPLACE FUNCTION public.supervisor_new_frontline(p_member_id uuid, p_month text)
 RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT wm.id)::integer
  FROM public.wellness_members wm
  JOIN public.wellness_memberships m ON m.member_id = wm.id AND m.renewed_from IS NULL
  JOIN public.wellness_plans p ON p.id = m.plan_id AND p.plan_type = 'membership'
  WHERE wm.referred_by_member_id = p_member_id
    AND m.status <> 'cancelled'
    AND to_char(COALESCE(m.payment_date, m.start_date), 'YYYY-MM') = p_month
$function$;

CREATE OR REPLACE FUNCTION public.recalc_network_counts(p_member_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fl integer; v_tot integer; v_sup boolean;
  v_month text; v_self boolean; v_new_fl integer; v_ok boolean;
BEGIN
  v_month := public.ist_month();

  WITH RECURSIVE net AS (
    SELECT wm.id, 1 AS depth, ('supervisor' = ANY(wm.tags)) AS is_sup
    FROM public.wellness_members wm
    WHERE wm.referred_by_member_id = p_member_id
    UNION ALL
    SELECT wm.id, n.depth + 1, ('supervisor' = ANY(wm.tags))
    FROM public.wellness_members wm
    INNER JOIN net n ON wm.referred_by_member_id = n.id
    WHERE n.depth < 20 AND NOT n.is_sup
  )
  SELECT COUNT(*) FILTER (WHERE depth = 1)::integer, COUNT(*)::integer
  INTO v_fl, v_tot
  FROM net WHERE public.member_active_in_month(net.id, v_month);

  SELECT 'supervisor' = ANY(tags) INTO v_sup FROM public.wellness_members WHERE id = p_member_id;
  v_fl := COALESCE(v_fl, 0); v_tot := COALESCE(v_tot, 0); v_sup := COALESCE(v_sup, false);

  v_self := public.member_active_in_month(p_member_id, v_month);
  v_new_fl := public.supervisor_new_frontline(p_member_id, v_month);
  v_ok := v_sup AND v_self AND v_new_fl >= 2;

  UPDATE public.wellness_members SET
    frontline_count = v_fl,
    cluster_count = v_tot - v_fl,
    network_total = v_tot,
    master_level = CASE WHEN NOT v_ok THEN 0
      WHEN v_tot >= 100 THEN 100 WHEN v_tot >= 90 THEN 90 WHEN v_tot >= 80 THEN 80
      WHEN v_tot >= 70 THEN 70 WHEN v_tot >= 60 THEN 60 WHEN v_tot >= 50 THEN 50
      WHEN v_tot >= 40 THEN 40 WHEN v_tot >= 30 THEN 30 WHEN v_tot >= 20 THEN 20
      WHEN v_tot >= 15 THEN 15 WHEN v_tot >= 10 THEN 10 ELSE 0 END
  WHERE id = p_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_network_summary(member_ids uuid[])
 RETURNS TABLE(root_id uuid, frontline_count integer, cluster_count integer, total_count integer, master_level integer)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT s.root_id, s.frontline_count, (s.total_count - s.frontline_count), s.total_count,
    CASE WHEN NOT (
        COALESCE((SELECT 'supervisor' = ANY(m.tags) FROM public.wellness_members m WHERE m.id = s.root_id), false)
        AND public.member_active_in_month(s.root_id, public.ist_month())
        AND public.supervisor_new_frontline(s.root_id, public.ist_month()) >= 2
      ) THEN 0
      WHEN s.total_count >= 100 THEN 100 WHEN s.total_count >= 90 THEN 90 WHEN s.total_count >= 80 THEN 80
      WHEN s.total_count >= 70 THEN 70 WHEN s.total_count >= 60 THEN 60 WHEN s.total_count >= 50 THEN 50
      WHEN s.total_count >= 40 THEN 40 WHEN s.total_count >= 30 THEN 30 WHEN s.total_count >= 20 THEN 20
      WHEN s.total_count >= 15 THEN 15 WHEN s.total_count >= 10 THEN 10 ELSE 0 END
  FROM (
    SELECT rid AS root_id,
      COUNT(*) FILTER (WHERE sub.depth = 1)::integer AS frontline_count,
      COUNT(sub.depth)::integer AS total_count
    FROM unnest(member_ids) AS rid
    LEFT JOIN LATERAL (
      WITH RECURSIVE net AS (
        SELECT wm.id, 1 AS depth, ('supervisor' = ANY(wm.tags)) AS is_sup
        FROM public.wellness_members wm WHERE wm.referred_by_member_id = rid
        UNION ALL
        SELECT wm.id, n.depth + 1, ('supervisor' = ANY(wm.tags))
        FROM public.wellness_members wm
        INNER JOIN net n ON wm.referred_by_member_id = n.id
        WHERE n.depth < 20 AND NOT n.is_sup
      )
      SELECT depth FROM net WHERE public.member_active_in_month(net.id, public.ist_month())
    ) sub ON true
    GROUP BY rid
  ) s;
$function$;

DROP FUNCTION IF EXISTS public.get_referral_network(uuid);

CREATE FUNCTION public.get_referral_network(root_member_id uuid)
 RETURNS TABLE(member_id uuid, full_name text, mobile_number text, status text, depth integer, referred_by uuid, qualifies_this_month boolean)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH RECURSIVE network AS (
    SELECT wm.id AS member_id, wm.full_name, wm.mobile_number, wm.status::text AS status,
           1 AS depth, wm.referred_by_member_id AS referred_by, ('supervisor' = ANY(wm.tags)) AS is_sup
    FROM public.wellness_members wm WHERE wm.referred_by_member_id = root_member_id
    UNION ALL
    SELECT wm.id, wm.full_name, wm.mobile_number, wm.status::text,
           n.depth + 1, wm.referred_by_member_id, ('supervisor' = ANY(wm.tags))
    FROM public.wellness_members wm
    INNER JOIN network n ON wm.referred_by_member_id = n.member_id
    WHERE n.depth < 20 AND NOT n.is_sup
  )
  SELECT network.member_id, network.full_name, network.mobile_number, network.status,
         network.depth, network.referred_by,
         public.member_active_in_month(network.member_id, public.ist_month())
  FROM network ORDER BY network.depth, network.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_supervisor_status(p_member_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month text; v_sup boolean; v_self boolean; v_new_fl integer;
  v_fl integer; v_tot integer; v_level integer;
BEGIN
  v_month := public.ist_month();
  SELECT 'supervisor' = ANY(tags), frontline_count, network_total, master_level
    INTO v_sup, v_fl, v_tot, v_level
  FROM public.wellness_members WHERE id = p_member_id;

  v_self := public.member_active_in_month(p_member_id, v_month);
  v_new_fl := public.supervisor_new_frontline(p_member_id, v_month);

  RETURN jsonb_build_object(
    'month', v_month,
    'is_supervisor', COALESCE(v_sup, false),
    'self_renewed', COALESCE(v_self, false),
    'new_frontline_count', COALESCE(v_new_fl, 0),
    'new_frontline_required', 2,
    'qualifying_frontline', COALESCE(v_fl, 0),
    'qualifying_network_total', COALESCE(v_tot, 0),
    'master_level', COALESCE(v_level, 0),
    'is_qualified', COALESCE(v_sup, false) AND COALESCE(v_self, false) AND COALESCE(v_new_fl, 0) >= 2
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ist_month() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.member_active_in_month(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.supervisor_new_frontline(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_supervisor_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_referral_network(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_network_summary(uuid[]) TO authenticated, service_role;