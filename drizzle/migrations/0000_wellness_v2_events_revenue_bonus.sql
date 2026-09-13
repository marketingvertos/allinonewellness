-- ========== 1. Payment tracking on memberships ==========
ALTER TABLE public.wellness_memberships
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_date date;

UPDATE public.wellness_memberships SET payment_date = start_date WHERE payment_date IS NULL;
ALTER TABLE public.wellness_memberships ALTER COLUMN payment_date SET DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date;

CREATE INDEX IF NOT EXISTS idx_memberships_payment_date ON public.wellness_memberships(payment_date);

-- ========== 2. Events & rewards tables ==========
CREATE TABLE IF NOT EXISTS public.wellness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  title text NOT NULL,
  event_date date NOT NULL,
  end_date date,
  month text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_single_per_month
  ON public.wellness_events(event_type, month)
  WHERE event_type IN ('family_day','lifestyle_day');
CREATE INDEX IF NOT EXISTS idx_wellness_events_month ON public.wellness_events(month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_events TO authenticated;
GRANT ALL ON public.wellness_events TO service_role;
ALTER TABLE public.wellness_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone signed in can view events" ON public.wellness_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert events" ON public.wellness_events
  FOR INSERT TO authenticated WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff update events" ON public.wellness_events
  FOR UPDATE TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff delete events" ON public.wellness_events
  FOR DELETE TO authenticated USING (public.is_wellness_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.wellness_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.wellness_events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  start_weight numeric,
  end_weight numeric,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_event_participants TO authenticated;
GRANT ALL ON public.wellness_event_participants TO service_role;
ALTER TABLE public.wellness_event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage participants" ON public.wellness_event_participants
  FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Members view own participation" ON public.wellness_event_participants
  FOR SELECT TO authenticated USING (public.owns_wellness_member(auth.uid(), member_id));

CREATE TABLE IF NOT EXISTS public.wellness_wlp_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  month text NOT NULL,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_wlp_attendance_month ON public.wellness_wlp_attendance(month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_wlp_attendance TO authenticated;
GRANT ALL ON public.wellness_wlp_attendance TO service_role;
ALTER TABLE public.wellness_wlp_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WLP attendance" ON public.wellness_wlp_attendance
  FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Members view own WLP attendance" ON public.wellness_wlp_attendance
  FOR SELECT TO authenticated USING (public.owns_wellness_member(auth.uid(), member_id));

CREATE TABLE IF NOT EXISTS public.wellness_monthly_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  month text NOT NULL,
  reward_type text NOT NULL,
  event_id uuid REFERENCES public.wellness_events(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, month, reward_type)
);
CREATE INDEX IF NOT EXISTS idx_monthly_rewards_month ON public.wellness_monthly_rewards(month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_monthly_rewards TO authenticated;
GRANT ALL ON public.wellness_monthly_rewards TO service_role;
ALTER TABLE public.wellness_monthly_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage rewards" ON public.wellness_monthly_rewards
  FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Members view own rewards" ON public.wellness_monthly_rewards
  FOR SELECT TO authenticated USING (public.owns_wellness_member(auth.uid(), member_id));

-- ========== 3. Monthly reward calculation ==========
CREATE OR REPLACE FUNCTION public.calc_monthly_rewards(p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_month_start date;
  v_month_end date;
  v_attendance integer;
  v_wlp integer;
  v_family_day uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;

  v_month_start := (p_month || '-01')::date;
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  SELECT id INTO v_family_day FROM public.wellness_events
   WHERE event_type = 'family_day' AND month = p_month LIMIT 1;

  FOR r IN SELECT id, gender, tags FROM public.wellness_members
            WHERE status IN ('active_member','renewal_due')
  LOOP
    SELECT count(DISTINCT visit_date) INTO v_attendance
      FROM public.wellness_attendance
     WHERE member_id = r.id AND visit_date BETWEEN v_month_start AND v_month_end;

    IF v_attendance >= 26 THEN
      INSERT INTO public.wellness_monthly_rewards(member_id, month, reward_type, event_id, details)
      VALUES (r.id, p_month, 'consistency_26', v_family_day,
              jsonb_build_object('attendance_days', v_attendance))
      ON CONFLICT (member_id, month, reward_type)
      DO UPDATE SET details = jsonb_build_object('attendance_days', v_attendance),
                    event_id = EXCLUDED.event_id;
    ELSE
      DELETE FROM public.wellness_monthly_rewards
       WHERE member_id = r.id AND month = p_month AND reward_type = 'consistency_26';
    END IF;

    IF r.tags @> ARRAY['coach'] THEN
      SELECT count(*) INTO v_wlp FROM public.wellness_wlp_attendance
       WHERE member_id = r.id AND month = p_month;

      IF v_wlp >= 4 THEN
        INSERT INTO public.wellness_monthly_rewards(member_id, month, reward_type, details)
        VALUES (r.id, p_month,
                CASE WHEN lower(COALESCE(r.gender,'')) = 'male' THEN 'wlp_king' ELSE 'wlp_queen' END,
                jsonb_build_object('wlp_sessions', v_wlp))
        ON CONFLICT (member_id, month, reward_type)
        DO UPDATE SET details = jsonb_build_object('wlp_sessions', v_wlp);
      ELSE
        DELETE FROM public.wellness_monthly_rewards
         WHERE member_id = r.id AND month = p_month AND reward_type IN ('wlp_king','wlp_queen');
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.calc_monthly_rewards(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_monthly_rewards(text) TO authenticated;

-- ========== 4. Reversible weight milestones ==========
CREATE OR REPLACE FUNCTION public.recalc_member_achievements(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member record;
  v_referrals integer;
  v_start numeric;
  v_current numeric;
  v_delta numeric;
  v_direction text;
  v_category text;
  v_own_active boolean;
  v_last_month text;
  v_met boolean;
  v_highest_sort integer;
BEGIN
  SELECT * INTO v_member FROM public.wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- ===== Coach (referral) titles: conditional + reversible =====
  v_own_active := (v_member.status IN ('active_member', 'renewal_due'));

  IF NOT v_own_active THEN
    DELETE FROM public.member_achievements ma
    USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id
      AND ma.member_id = p_member_id
      AND d.category = 'referral';
  ELSE
    SELECT count(*) INTO v_referrals FROM public.wellness_members
     WHERE referred_by_member_id = p_member_id
       AND status IN ('active_member', 'renewal_due');

    v_last_month := to_char(
      (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day'), 'YYYY-MM');

    SELECT met_requirement INTO v_met
    FROM public.coach_monthly_activity
    WHERE coach_id = p_member_id AND month = v_last_month;

    IF v_met IS DISTINCT FROM true
       AND COALESCE(v_member.last_title_downgrade_month, '') <> v_last_month THEN
      SELECT MAX(d.sort_order) INTO v_highest_sort
      FROM public.member_achievements ma
      JOIN public.achievement_definitions d ON d.id = ma.achievement_id
      WHERE ma.member_id = p_member_id AND d.category = 'referral';

      IF v_highest_sort IS NOT NULL THEN
        DELETE FROM public.member_achievements ma
        USING public.achievement_definitions d
        WHERE ma.achievement_id = d.id
          AND ma.member_id = p_member_id
          AND d.category = 'referral'
          AND d.sort_order = v_highest_sort;

        UPDATE public.wellness_members
           SET last_title_downgrade_month = v_last_month
         WHERE id = p_member_id;

        v_member.last_title_downgrade_month := v_last_month;
      END IF;
    END IF;

    DELETE FROM public.member_achievements ma
    USING public.achievement_definitions d
    WHERE ma.achievement_id = d.id
      AND ma.member_id = p_member_id
      AND d.category = 'referral'
      AND v_referrals < d.threshold;

    INSERT INTO public.member_achievements(member_id, achievement_id)
    SELECT p_member_id, d.id FROM public.achievement_definitions d
     WHERE d.category = 'referral' AND d.is_active AND v_referrals >= d.threshold
       AND NOT (
         COALESCE(v_member.last_title_downgrade_month, '') = v_last_month
         AND v_met IS DISTINCT FROM true
         AND d.sort_order >= COALESCE(v_highest_sort, 2147483647)
       )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===== Weight milestones: now reversible =====
  v_start := COALESCE(v_member.initial_weight,
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date ASC, w.created_at ASC LIMIT 1));
  v_current := COALESCE(
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date DESC, w.created_at DESC LIMIT 1),
    v_member.current_weight);

  IF v_start IS NULL OR v_current IS NULL THEN RETURN; END IF;

  SELECT c.direction INTO v_direction FROM public.member_categories c WHERE c.id = v_member.category_id;
  IF v_direction IS NULL THEN
    v_direction := CASE WHEN v_member.goal = 'weight_gain' THEN 'gain' ELSE 'loss' END;
  END IF;

  IF v_direction = 'gain' THEN
    v_category := 'weight_gain';
    v_delta := v_current - v_start;
  ELSE
    v_category := 'weight_loss';
    v_delta := v_start - v_current;
  END IF;

  -- Drop milestones from the opposite goal category
  DELETE FROM public.member_achievements ma
  USING public.achievement_definitions d
  WHERE ma.achievement_id = d.id
    AND ma.member_id = p_member_id
    AND d.category IN ('weight_loss','weight_gain')
    AND d.category <> v_category;

  -- Drop milestones the member no longer qualifies for
  DELETE FROM public.member_achievements ma
  USING public.achievement_definitions d
  WHERE ma.achievement_id = d.id
    AND ma.member_id = p_member_id
    AND d.category = v_category
    AND v_delta < d.threshold;

  IF v_delta <= 0 THEN RETURN; END IF;

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = v_category AND d.is_active AND v_delta >= d.threshold
  ON CONFLICT DO NOTHING;
END;
$$;

-- ========== 5. Renewal: payment details + early renewal bonus ==========
DROP FUNCTION IF EXISTS public.renew_membership_v2(uuid, uuid, integer, numeric, text, text);

CREATE OR REPLACE FUNCTION public.renew_membership_v2(
  p_membership_id uuid,
  p_plan_id uuid,
  p_servings integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_mode text DEFAULT 'queue',
  p_note text DEFAULT NULL,
  p_payment_mode text DEFAULT 'cash',
  p_payment_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old record; v_plan record; v_servings integer; v_new_id uuid; v_code text;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_pay_date date;
  v_is_early boolean;
  v_bonus integer := 2;
  v_balance integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF p_mode NOT IN ('queue','extend','replace') THEN RAISE EXCEPTION 'Invalid renewal mode.'; END IF;

  v_pay_date := COALESCE(p_payment_date, v_today);

  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = COALESCE(p_plan_id, v_old.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_servings := GREATEST(COALESCE(p_servings, v_plan.total_servings), 0);
  v_is_early := (v_today <= v_old.end_date);

  IF p_mode = 'extend' THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_servings,
           remaining_servings = remaining_servings + v_servings,
           end_date = (GREATEST(end_date, v_today) + v_plan.duration_days)::date,
           status = 'active',
           payment_mode = COALESCE(p_payment_mode, 'cash'),
           payment_date = v_pay_date
     WHERE id = p_membership_id
     RETURNING id INTO v_new_id;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    SELECT member_id, id, 'renewal_allocation', v_servings, remaining_servings, auth.uid(), COALESCE(p_note,'Added to current plan')
      FROM wellness_memberships WHERE id = p_membership_id;
  ELSE
    v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

    IF p_mode = 'replace' THEN
      UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;

      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by,
        payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by,
        payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, (GREATEST(v_old.end_date, v_today) + 1)::date,
        (GREATEST(v_old.end_date, v_today) + 1 + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'queued', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    END IF;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'renewal_allocation', v_servings, v_servings, auth.uid(),
      COALESCE(p_note, CASE WHEN p_mode = 'queue' THEN 'Queued renewal' ELSE 'Renewal (replaced current plan)' END));
  END IF;

  -- Early renewal bonus: renewed on or before the old plan's end date
  IF v_is_early AND v_servings > 0 THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_bonus,
           remaining_servings = remaining_servings + v_bonus
     WHERE id = v_new_id
     RETURNING remaining_servings INTO v_balance;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'manual_adjustment', v_bonus, v_balance, auth.uid(),
            'Early renewal bonus (+2 servings)');

    INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
    VALUES (v_old.member_id, 'early_renewal_bonus', 'whatsapp');
  END IF;

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_old.member_id, 'membership_renewed', 'whatsapp');

  IF p_mode = 'queue' THEN
    PERFORM public.activate_next_membership(v_old.member_id);
  END IF;

  RETURN v_new_id;
END; $$;
REVOKE ALL ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text, text, date) TO authenticated;
