-- Add referral_acquaintance column: 'known' or 'unknown', nullable (only set when referrer is a coach)
ALTER TABLE public.wellness_members ADD COLUMN IF NOT EXISTS referral_acquaintance text;
ALTER TABLE public.wellness_members DROP CONSTRAINT IF EXISTS wellness_members_referral_acquaintance_check;
ALTER TABLE public.wellness_members ADD CONSTRAINT wellness_members_referral_acquaintance_check
  CHECK (referral_acquaintance IS NULL OR referral_acquaintance IN ('known', 'unknown'));

ALTER TABLE public.wellness_leads ADD COLUMN IF NOT EXISTS referral_acquaintance text;
ALTER TABLE public.wellness_leads DROP CONSTRAINT IF EXISTS wellness_leads_referral_acquaintance_check;
ALTER TABLE public.wellness_leads ADD CONSTRAINT wellness_leads_referral_acquaintance_check
  CHECK (referral_acquaintance IS NULL OR referral_acquaintance IN ('known', 'unknown'));

-- Update the introducer report RPC to include referral_acquaintance
DROP FUNCTION IF EXISTS public.get_introducer_report(date, date);
CREATE FUNCTION public.get_introducer_report(_from date, _to date)
 RETURNS TABLE(member_id uuid, full_name text, mobile_number text, joined_on date, status text, current_plan text,
   introducer_id uuid, introducer_name text, introducer_mobile text, introducer_kind text, gold_type text,
   referral_acquaintance text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT m.id, m.full_name, m.mobile_number, coalesce(m.joining_date, (m.created_at AT TIME ZONE 'Asia/Kolkata')::date),
    m.status::text,
    lm.plan_name,
    r.id,
    coalesce(r.full_name, m.referrer_name),
    coalesce(r.mobile_number, m.referrer_mobile),
    CASE WHEN r.id IS NOT NULL AND 'coach' = ANY(r.tags) THEN 'coach'
         WHEN r.id IS NOT NULL THEN 'member'
         WHEN coalesce(m.referrer_name,'') <> '' THEN 'outside'
         ELSE 'none' END,
    CASE WHEN lm.plan_name IS NULL OR NOT (lm.plan_name ILIKE '%gold%' OR lm.plan_name ILIKE '%ums%') THEN NULL
         WHEN EXISTS (SELECT 1 FROM wellness_payments wp WHERE wp.membership_id = lm.ms_id AND wp.context = 'renewal')
           OR (SELECT count(*) FROM wellness_memberships ms2 JOIN wellness_plans p2 ON p2.id = ms2.plan_id
                 WHERE ms2.member_id = m.id AND (p2.name ILIKE '%gold%' OR p2.name ILIKE '%ums%')) > 1
         THEN 'renewal' ELSE 'new' END,
    m.referral_acquaintance
  FROM wellness_members m
  LEFT JOIN wellness_members r ON r.id = m.referred_by_member_id
  LEFT JOIN LATERAL (SELECT ms.id AS ms_id, p.name AS plan_name FROM wellness_memberships ms JOIN wellness_plans p ON p.id = ms.plan_id
       WHERE ms.member_id = m.id ORDER BY ms.created_at DESC LIMIT 1) lm ON true
  WHERE public.is_wellness_staff(auth.uid())
    AND coalesce(m.joining_date, (m.created_at AT TIME ZONE 'Asia/Kolkata')::date) BETWEEN _from AND _to
$function$;
GRANT EXECUTE ON FUNCTION public.get_introducer_report(date, date) TO authenticated;
