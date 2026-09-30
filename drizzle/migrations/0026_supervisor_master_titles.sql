CREATE OR REPLACE FUNCTION public.recalc_network_counts(p_member_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fl integer; v_tot integer; v_sup boolean;
BEGIN
  -- Supervisors appear in their upline's network, but their own downline does not.
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
  SELECT COUNT(*) FILTER (WHERE depth = 1)::integer, COUNT(*)::integer INTO v_fl, v_tot FROM net;

  SELECT 'supervisor' = ANY(tags) INTO v_sup FROM public.wellness_members WHERE id = p_member_id;
  v_fl := COALESCE(v_fl, 0); v_tot := COALESCE(v_tot, 0);

  UPDATE public.wellness_members SET
    frontline_count = v_fl,
    cluster_count = v_tot - v_fl,
    network_total = v_tot,
    master_level = CASE WHEN NOT COALESCE(v_sup, false) THEN 0
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
    CASE WHEN NOT COALESCE((SELECT 'supervisor' = ANY(m.tags) FROM public.wellness_members m WHERE m.id = s.root_id), false) THEN 0
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
      SELECT depth FROM net
    ) sub ON true
    GROUP BY rid
  ) s;
$function$;

CREATE OR REPLACE FUNCTION public.get_referral_network(root_member_id uuid)
 RETURNS TABLE(member_id uuid, full_name text, mobile_number text, status text, depth integer, referred_by uuid)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH RECURSIVE network AS (
    SELECT wm.id AS member_id, wm.full_name, wm.mobile_number, wm.status::text,
           1 AS depth, wm.referred_by_member_id AS referred_by, ('supervisor' = ANY(wm.tags)) AS is_sup
    FROM public.wellness_members wm WHERE wm.referred_by_member_id = root_member_id
    UNION ALL
    SELECT wm.id, wm.full_name, wm.mobile_number, wm.status::text,
           n.depth + 1, wm.referred_by_member_id, ('supervisor' = ANY(wm.tags))
    FROM public.wellness_members wm
    INNER JOIN network n ON wm.referred_by_member_id = n.member_id
    WHERE n.depth < 20 AND NOT n.is_sup
  )
  SELECT member_id, full_name, mobile_number, status, depth, referred_by FROM network ORDER BY depth, full_name;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_network_counts()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a uuid; guard integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.tags IS DISTINCT FROM NEW.tags THEN
    PERFORM public.recalc_network_counts(NEW.id);
  END IF;

  IF NEW.referred_by_member_id IS NOT NULL THEN
    a := NEW.referred_by_member_id; guard := 0;
    WHILE a IS NOT NULL AND guard < 20 LOOP
      PERFORM public.recalc_network_counts(a);
      SELECT referred_by_member_id INTO a FROM public.wellness_members WHERE id = a;
      guard := guard + 1;
    END LOOP;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.referred_by_member_id IS DISTINCT FROM NEW.referred_by_member_id
     AND OLD.referred_by_member_id IS NOT NULL THEN
    a := OLD.referred_by_member_id; guard := 0;
    WHILE a IS NOT NULL AND guard < 20 LOOP
      PERFORM public.recalc_network_counts(a);
      SELECT referred_by_member_id INTO a FROM public.wellness_members WHERE id = a;
      guard := guard + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_network_counts ON public.wellness_members;
CREATE TRIGGER trg_refresh_network_counts
AFTER INSERT OR UPDATE OF referred_by_member_id, tags ON public.wellness_members
FOR EACH ROW EXECUTE FUNCTION public.refresh_network_counts();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.wellness_members LOOP
    PERFORM public.recalc_network_counts(r.id);
  END LOOP;
END $$;