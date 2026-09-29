CREATE TABLE public.daily_operations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL UNIQUE,
  milk_amount numeric NOT NULL DEFAULT 0,
  product_retail_amount numeric NOT NULL DEFAULT 0,
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.daily_operations_log TO authenticated;
GRANT ALL ON public.daily_operations_log TO service_role;
ALTER TABLE public.daily_operations_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read daily ops" ON public.daily_operations_log FOR SELECT TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff insert daily ops" ON public.daily_operations_log FOR INSERT TO authenticated WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff update daily ops" ON public.daily_operations_log FOR UPDATE TO authenticated USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE TRIGGER trg_daily_ops_updated BEFORE UPDATE ON public.daily_operations_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.monthly_operations_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE,
  volume_points numeric NOT NULL DEFAULT 0,
  ae_qualify_count integer NOT NULL DEFAULT 0,
  afresh_party_count integer NOT NULL DEFAULT 0,
  lead_generation_count integer,
  lsd_ticket_count integer NOT NULL DEFAULT 0,
  capital_amount numeric NOT NULL DEFAULT 0,
  total_retail_by_coaches numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.monthly_operations_summary TO authenticated;
GRANT ALL ON public.monthly_operations_summary TO service_role;
ALTER TABLE public.monthly_operations_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read monthly ops" ON public.monthly_operations_summary FOR SELECT TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff insert monthly ops" ON public.monthly_operations_summary FOR INSERT TO authenticated WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff update monthly ops" ON public.monthly_operations_summary FOR UPDATE TO authenticated USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE TRIGGER trg_monthly_ops_updated BEFORE UPDATE ON public.monthly_operations_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_club_daily_report(p_month text)
RETURNS TABLE(day date, total_shake integer, new_guest integer, tp_new integer, tp_repeat integer,
  ums15_new integer, ums15_renew integer, ums30_cust_new integer, ums30_cust_renew integer, ums30_coach integer,
  total_amount numeric, cash numeric, swipe numeric, upi numeric, online numeric,
  milk numeric, product_retail numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_start date := to_date(p_month || '-01', 'YYYY-MM-DD');
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(v_start, (v_start + interval '1 month' - interval '1 day')::date, interval '1 day') d
  ),
  ms AS (
    SELECT (m.created_at AT TIME ZONE 'Asia/Kolkata')::date AS d, p.total_servings AS sv,
      (m.renewed_from IS NOT NULL OR p.name ILIKE 'renewal%') AS renew,
      ('coach' = ANY(w.tags)) AS coach
    FROM wellness_memberships m JOIN wellness_plans p ON p.id = m.plan_id JOIN wellness_members w ON w.id = m.member_id
    WHERE p.plan_type = 'membership' AND m.status <> 'cancelled'
  ),
  tr AS (
    SELECT (t.created_at AT TIME ZONE 'Asia/Kolkata')::date AS d, w.is_guest,
      (p.plan_type = 'trial' AND p.total_servings = 3 AND p.price > 0) AS paid3,
      EXISTS (SELECT 1 FROM wellness_trials t2 WHERE t2.member_id = t.member_id AND t2.created_at < t.created_at) AS repeat
    FROM wellness_trials t JOIN wellness_members w ON w.id = t.member_id LEFT JOIN wellness_plans p ON p.id = t.plan_id
    WHERE t.status <> 'cancelled'
  ),
  pay AS (
    SELECT (paid_at AT TIME ZONE 'Asia/Kolkata')::date AS d, mode, amount FROM wellness_payments
  )
  SELECT dd.day,
    (SELECT count(*) FROM wellness_attendance a WHERE a.visit_date = dd.day)::int,
    (SELECT count(*) FROM tr WHERE tr.d = dd.day AND tr.is_guest)::int,
    (SELECT count(*) FROM tr WHERE tr.d = dd.day AND tr.paid3 AND NOT tr.repeat)::int,
    (SELECT count(*) FROM tr WHERE tr.d = dd.day AND tr.paid3 AND tr.repeat)::int,
    (SELECT count(*) FROM ms WHERE ms.d = dd.day AND ms.sv = 15 AND NOT ms.renew)::int,
    (SELECT count(*) FROM ms WHERE ms.d = dd.day AND ms.sv = 15 AND ms.renew)::int,
    (SELECT count(*) FROM ms WHERE ms.d = dd.day AND ms.sv = 30 AND NOT ms.renew AND NOT ms.coach)::int,
    (SELECT count(*) FROM ms WHERE ms.d = dd.day AND ms.sv = 30 AND ms.renew AND NOT ms.coach)::int,
    (SELECT count(*) FROM ms WHERE ms.d = dd.day AND ms.sv = 30 AND ms.coach)::int,
    COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = dd.day), 0),
    COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = dd.day AND pay.mode = 'cash'), 0),
    COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = dd.day AND pay.mode = 'card'), 0),
    COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = dd.day AND pay.mode = 'upi'), 0),
    COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = dd.day AND pay.mode = 'online'), 0),
    COALESCE((SELECT o.milk_amount FROM daily_operations_log o WHERE o.log_date = dd.day), 0),
    COALESCE((SELECT o.product_retail_amount FROM daily_operations_log o WHERE o.log_date = dd.day), 0)
  FROM days dd ORDER BY dd.day;
END $$;

CREATE OR REPLACE FUNCTION public.get_club_monthly_report(p_month text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_start date := to_date(p_month || '-01', 'YYYY-MM-DD'); v_end date; r jsonb;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  v_end := (v_start + interval '1 month')::date;
  WITH ms AS (
    SELECT p.total_servings AS sv, (m.renewed_from IS NOT NULL OR p.name ILIKE 'renewal%') AS renew, ('coach' = ANY(w.tags)) AS coach
    FROM wellness_memberships m JOIN wellness_plans p ON p.id = m.plan_id JOIN wellness_members w ON w.id = m.member_id
    WHERE p.plan_type = 'membership' AND m.status <> 'cancelled'
      AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_start AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date < v_end
  )
  SELECT jsonb_build_object(
    'total_shake', (SELECT count(*) FROM wellness_attendance WHERE visit_date >= v_start AND visit_date < v_end),
    'new_guest', (SELECT count(*) FROM wellness_trials t JOIN wellness_members w ON w.id = t.member_id WHERE w.is_guest AND t.status <> 'cancelled' AND (t.created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_start AND (t.created_at AT TIME ZONE 'Asia/Kolkata')::date < v_end),
    'trials_3day', (SELECT count(*) FROM wellness_trials t JOIN wellness_plans p ON p.id = t.plan_id WHERE p.total_servings = 3 AND p.price > 0 AND t.status <> 'cancelled' AND (t.created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_start AND (t.created_at AT TIME ZONE 'Asia/Kolkata')::date < v_end),
    'ums15', (SELECT count(*) FROM ms WHERE sv = 15),
    'ums30', (SELECT count(*) FROM ms WHERE sv = 30),
    'ums30_new_cust', (SELECT count(*) FROM ms WHERE sv = 30 AND NOT renew AND NOT coach),
    'ums15_new_cust', (SELECT count(*) FROM ms WHERE sv = 15 AND NOT renew AND NOT coach),
    'total_customers', (SELECT count(*) FROM wellness_members WHERE status IN ('active_member','renewal_due')),
    'total_coaches', (SELECT count(*) FROM wellness_members WHERE 'coach' = ANY(tags)),
    'total_amount', COALESCE((SELECT sum(amount) FROM wellness_payments WHERE (paid_at AT TIME ZONE 'Asia/Kolkata')::date >= v_start AND (paid_at AT TIME ZONE 'Asia/Kolkata')::date < v_end), 0),
    'lead_generation_auto', (SELECT count(*) FROM wellness_members c JOIN wellness_members rf ON rf.id = c.referred_by_member_id WHERE 'coach' = ANY(rf.tags) AND c.joining_date >= v_start AND c.joining_date < v_end)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.get_club_daily_report(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_monthly_report(text) TO authenticated;