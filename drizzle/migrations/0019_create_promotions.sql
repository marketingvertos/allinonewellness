CREATE TABLE public.wellness_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_description text NOT NULL DEFAULT '',
  banner_message text,
  icon text NOT NULL DEFAULT '🎯',
  offer_type text NOT NULL DEFAULT 'referral_challenge',
  target_metric text NOT NULL DEFAULT 'new_referrals',
  target_count integer,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'all',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_promotions TO authenticated;
GRANT ALL ON public.wellness_promotions TO service_role;
ALTER TABLE public.wellness_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view promotions" ON public.wellness_promotions FOR SELECT TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Members view live promotions" ON public.wellness_promotions FOR SELECT TO authenticated USING (is_active AND end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date);
CREATE POLICY "Managers insert promotions" ON public.wellness_promotions FOR INSERT TO authenticated WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE POLICY "Managers update promotions" ON public.wellness_promotions FOR UPDATE TO authenticated USING (public.is_wellness_manager(auth.uid()));
CREATE POLICY "Managers delete promotions" ON public.wellness_promotions FOR DELETE TO authenticated USING (public.is_wellness_manager(auth.uid()));

CREATE TABLE public.wellness_promotion_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.wellness_promotions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  current_count integer NOT NULL DEFAULT 0,
  qualified boolean NOT NULL DEFAULT false,
  qualified_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false,
  reward_claimed_at timestamptz,
  reward_claimed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, member_id)
);
GRANT SELECT ON public.wellness_promotion_progress TO authenticated;
GRANT ALL ON public.wellness_promotion_progress TO service_role;
ALTER TABLE public.wellness_promotion_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view progress" ON public.wellness_promotion_progress FOR SELECT TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Members view own progress" ON public.wellness_promotion_progress FOR SELECT TO authenticated USING (public.owns_wellness_member(auth.uid(), member_id));

CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON public.wellness_promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_promotion_progress_updated BEFORE UPDATE ON public.wellness_promotion_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_promotion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.offer_type NOT IN ('referral_challenge','qualification','announcement') THEN RAISE EXCEPTION 'Invalid offer type'; END IF;
  IF NEW.target_metric NOT IN ('new_referrals','new_memberships','attendance_days','none') THEN RAISE EXCEPTION 'Invalid target'; END IF;
  IF NEW.visibility NOT IN ('all','physical','virtual') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'End date must be on or after start date'; END IF;
  IF NEW.offer_type = 'announcement' THEN NEW.target_metric := 'none'; NEW.target_count := NULL; END IF;
  IF NEW.offer_type <> 'announcement' AND (NEW.target_count IS NULL OR NEW.target_count < 1 OR NEW.target_metric = 'none') THEN
    RAISE EXCEPTION 'Tracked offers need a target of at least 1'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_promotion BEFORE INSERT OR UPDATE ON public.wellness_promotions FOR EACH ROW EXECUTE FUNCTION public.validate_promotion();

CREATE OR REPLACE FUNCTION public.calc_promotion_progress(p_promotion_id uuid, p_member_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p record; v_count integer := 0; v_from timestamptz; v_to timestamptz; v_q boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_wellness_staff(auth.uid()) AND NOT public.owns_wellness_member(auth.uid(), p_member_id) THEN
    RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO v_p FROM wellness_promotions WHERE id = p_promotion_id;
  IF NOT FOUND OR v_p.offer_type = 'announcement' THEN RETURN 0; END IF;
  v_from := (v_p.start_date::timestamp) AT TIME ZONE 'Asia/Kolkata';
  v_to := ((v_p.end_date + 1)::timestamp) AT TIME ZONE 'Asia/Kolkata';
  IF v_p.target_metric = 'new_referrals' THEN
    SELECT count(*) INTO v_count FROM wellness_members WHERE referred_by_member_id = p_member_id
      AND joining_date BETWEEN v_p.start_date AND v_p.end_date AND status NOT IN ('lead','inactive');
  ELSIF v_p.target_metric = 'new_memberships' THEN
    SELECT count(*) INTO v_count FROM wellness_memberships ms JOIN wellness_members m ON m.id = ms.member_id
      WHERE m.referred_by_member_id = p_member_id AND ms.created_at >= v_from AND ms.created_at < v_to AND ms.status <> 'cancelled';
  ELSIF v_p.target_metric = 'attendance_days' THEN
    SELECT count(DISTINCT visit_date) INTO v_count FROM wellness_attendance WHERE member_id = p_member_id
      AND visit_date BETWEEN v_p.start_date AND v_p.end_date;
  END IF;
  v_q := v_count >= coalesce(v_p.target_count, 2147483647);
  INSERT INTO wellness_promotion_progress (promotion_id, member_id, current_count, qualified, qualified_at)
  VALUES (p_promotion_id, p_member_id, v_count, v_q, CASE WHEN v_q THEN now() END)
  ON CONFLICT (promotion_id, member_id) DO UPDATE SET current_count = EXCLUDED.current_count,
    qualified = EXCLUDED.qualified OR wellness_promotion_progress.reward_claimed,
    qualified_at = coalesce(wellness_promotion_progress.qualified_at, EXCLUDED.qualified_at);
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.calc_promotion_progress_all(p_promotion_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p record; r record; n integer := 0;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO v_p FROM wellness_promotions WHERE id = p_promotion_id;
  IF NOT FOUND OR v_p.offer_type = 'announcement' THEN RETURN 0; END IF;
  FOR r IN
    SELECT DISTINCT mid FROM (
      SELECT referred_by_member_id AS mid FROM wellness_members WHERE referred_by_member_id IS NOT NULL AND v_p.target_metric IN ('new_referrals','new_memberships')
      UNION SELECT member_id FROM wellness_attendance WHERE v_p.target_metric = 'attendance_days' AND visit_date BETWEEN v_p.start_date AND v_p.end_date
      UNION SELECT member_id FROM wellness_promotion_progress WHERE promotion_id = p_promotion_id
    ) s WHERE mid IS NOT NULL
  LOOP
    PERFORM public.calc_promotion_progress(p_promotion_id, r.mid); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.mark_promotion_reward(p_progress_id uuid, p_claimed boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Only managers can mark rewards'; END IF;
  UPDATE wellness_promotion_progress SET reward_claimed = p_claimed,
    reward_claimed_at = CASE WHEN p_claimed THEN now() END,
    reward_claimed_by = CASE WHEN p_claimed THEN auth.uid() END,
    notes = coalesce(nullif(trim(p_note), ''), notes)
  WHERE id = p_progress_id;
END $$;