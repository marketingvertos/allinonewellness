ALTER TABLE public.wellness_members ADD COLUMN IF NOT EXISTS referrer_name text, ADD COLUMN IF NOT EXISTS referrer_mobile text;
ALTER TABLE public.wellness_leads ADD COLUMN IF NOT EXISTS referrer_name text, ADD COLUMN IF NOT EXISTS referrer_mobile text;
ALTER TABLE public.wellness_plans ADD COLUMN IF NOT EXISTS plan_usage text NOT NULL DEFAULT 'both';
ALTER TABLE public.wellness_plans DROP CONSTRAINT IF EXISTS wellness_plans_plan_usage_check;
ALTER TABLE public.wellness_plans ADD CONSTRAINT wellness_plans_plan_usage_check CHECK (plan_usage IN ('new','renewal','both'));

UPDATE public.wellness_plans SET plan_usage = 'renewal' WHERE name ILIKE '%renewal%';
UPDATE public.wellness_plans SET plan_usage = 'new' WHERE name IN ('3 Days Free Trial','3-Day Paid Trial','15 Visit-White Card','NEW Gold Card UMS-7500','1st Day Free Trial','Daily Paid','10 day');

-- Backfill outside introducers from earlier notes
UPDATE public.wellness_members m SET referrer_name = sub.nm
FROM (
  SELECT DISTINCT ON (member_id) member_id, trim(substring(note from 'Introduced by:\s*([^\n]+)')) AS nm
  FROM public.member_notes WHERE note ~ 'Introduced by:' ORDER BY member_id, created_at DESC
) sub
WHERE sub.member_id = m.id AND m.referred_by_member_id IS NULL AND m.referrer_name IS NULL AND coalesce(sub.nm,'') <> '';

CREATE OR REPLACE FUNCTION public.get_introducer_report(_from date, _to date)
RETURNS TABLE(member_id uuid, full_name text, mobile_number text, joined_on date, status text, current_plan text,
  introducer_id uuid, introducer_name text, introducer_mobile text, introducer_kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.full_name, m.mobile_number, coalesce(m.joining_date, (m.created_at AT TIME ZONE 'Asia/Kolkata')::date),
    m.status::text,
    (SELECT p.name FROM wellness_memberships ms JOIN wellness_plans p ON p.id = ms.plan_id
       WHERE ms.member_id = m.id ORDER BY ms.created_at DESC LIMIT 1),
    r.id,
    coalesce(r.full_name, m.referrer_name),
    coalesce(r.mobile_number, m.referrer_mobile),
    CASE WHEN r.id IS NOT NULL AND 'coach' = ANY(r.tags) THEN 'coach'
         WHEN r.id IS NOT NULL THEN 'member'
         WHEN coalesce(m.referrer_name,'') <> '' THEN 'outside'
         ELSE 'none' END
  FROM wellness_members m
  LEFT JOIN wellness_members r ON r.id = m.referred_by_member_id
  WHERE public.is_wellness_staff(auth.uid())
    AND coalesce(m.joining_date, (m.created_at AT TIME ZONE 'Asia/Kolkata')::date) BETWEEN _from AND _to
$$;
REVOKE ALL ON FUNCTION public.get_introducer_report(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_introducer_report(date, date) TO authenticated;