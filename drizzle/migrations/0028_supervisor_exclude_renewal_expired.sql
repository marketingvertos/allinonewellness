CREATE OR REPLACE FUNCTION public.member_active_in_month(p_member_id uuid, p_month text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.wellness_members wm
    JOIN public.wellness_memberships m ON m.member_id = wm.id
    JOIN public.wellness_plans p ON p.id = m.plan_id
    WHERE wm.id = p_member_id
      AND wm.status = 'active_member'
      AND p.plan_type = 'membership'
      AND m.status = 'active'
      AND to_char(COALESCE(m.payment_date, m.start_date), 'YYYY-MM') = p_month
  )
$function$;

CREATE OR REPLACE FUNCTION public.supervisor_new_frontline(p_member_id uuid, p_month text)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT wm.id)::integer
  FROM public.wellness_members wm
  JOIN public.wellness_memberships m ON m.member_id = wm.id AND m.renewed_from IS NULL
  JOIN public.wellness_plans p ON p.id = m.plan_id AND p.plan_type = 'membership'
  WHERE wm.referred_by_member_id = p_member_id
    AND wm.status = 'active_member'
    AND m.status = 'active'
    AND to_char(COALESCE(m.payment_date, m.start_date), 'YYYY-MM') = p_month
$function$;