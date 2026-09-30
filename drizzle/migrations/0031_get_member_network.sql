CREATE OR REPLACE FUNCTION public.get_member_network(p_member_id uuid)
RETURNS TABLE(member_id uuid, full_name text, status text, depth integer, referred_by uuid,
  qualifies_this_month boolean, plan_name text, plan_type text, duration_days integer, total_servings integer,
  membership_status text, start_date date, end_date date, remaining_servings integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_month text := public.ist_month();
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  WITH RECURSIVE network AS (
    SELECT wm.id AS mid, wm.full_name AS fname, wm.status::text AS st, 1 AS d, wm.referred_by_member_id AS rb,
           ('supervisor' = ANY(wm.tags)) AS is_sup
    FROM public.wellness_members wm WHERE wm.referred_by_member_id = p_member_id
    UNION ALL
    SELECT wm.id, wm.full_name, wm.status::text, n.d + 1, wm.referred_by_member_id, ('supervisor' = ANY(wm.tags))
    FROM public.wellness_members wm JOIN network n ON wm.referred_by_member_id = n.mid
    WHERE n.d < 20 AND NOT n.is_sup
  )
  SELECT n.mid, n.fname, n.st, n.d, n.rb,
         public.member_active_in_month(n.mid, v_month),
         lm.pname, lm.ptype, lm.pdur, lm.pserv, lm.mstatus, lm.sdate, lm.edate, lm.rem
  FROM network n
  LEFT JOIN LATERAL (
    SELECT p.name AS pname, p.plan_type AS ptype, p.duration_days AS pdur, p.total_servings AS pserv,
           m.status::text AS mstatus, m.start_date AS sdate, m.end_date AS edate, m.remaining_servings AS rem
    FROM public.wellness_memberships m JOIN public.wellness_plans p ON p.id = m.plan_id
    WHERE m.member_id = n.mid AND m.status <> 'cancelled'
    ORDER BY (m.status IN ('active','expiring_soon')) DESC, m.start_date DESC LIMIT 1
  ) lm ON true
  ORDER BY n.d, n.fname;
END $$;
REVOKE ALL ON FUNCTION public.get_member_network(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_network(uuid) TO authenticated, service_role;