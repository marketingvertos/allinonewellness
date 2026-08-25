-- 1. Referral link on members
ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS referred_by_member_id uuid REFERENCES public.wellness_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wellness_members_referred_by ON public.wellness_members(referred_by_member_id);

CREATE OR REPLACE FUNCTION public.guard_member_referral()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_parent uuid;
BEGIN
  IF NEW.referred_by_member_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.referred_by_member_id = NEW.id THEN
    RAISE EXCEPTION 'A member cannot refer themselves.';
  END IF;
  SELECT referred_by_member_id INTO v_parent FROM public.wellness_members WHERE id = NEW.referred_by_member_id;
  IF v_parent = NEW.id THEN
    RAISE EXCEPTION 'Circular referral is not allowed.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_wellness_member_referral ON public.wellness_members;
CREATE TRIGGER guard_wellness_member_referral
BEFORE INSERT OR UPDATE ON public.wellness_members
FOR EACH ROW EXECUTE FUNCTION public.guard_member_referral();

-- 2. Achievement definitions
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('referral','weight_loss','weight_gain')),
  name text NOT NULL,
  threshold numeric NOT NULL CHECK (threshold > 0),
  unit text NOT NULL DEFAULT 'people',
  icon text NOT NULL DEFAULT '🏅',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievement_definitions TO authenticated;
GRANT ALL ON public.achievement_definitions TO service_role;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view achievement milestones"
ON public.achievement_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage achievement milestones"
ON public.achievement_definitions FOR ALL TO authenticated
USING (public.is_wellness_manager(auth.uid()))
WITH CHECK (public.is_wellness_manager(auth.uid()));

CREATE TRIGGER update_achievement_definitions_updated_at
BEFORE UPDATE ON public.achievement_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Unlocked achievements
CREATE TABLE IF NOT EXISTS public.member_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, achievement_id)
);

GRANT SELECT ON public.member_achievements TO authenticated;
GRANT ALL ON public.member_achievements TO service_role;
ALTER TABLE public.member_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all member achievements"
ON public.member_achievements FOR SELECT TO authenticated
USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));

-- 4. Recalculation
CREATE OR REPLACE FUNCTION public.recalc_member_achievements(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_referrals integer;
  v_start numeric;
  v_current numeric;
  v_delta numeric;
  v_category text;
BEGIN
  SELECT * INTO v_member FROM public.wellness_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_referrals FROM public.wellness_members
   WHERE referred_by_member_id = p_member_id AND status <> 'inactive';

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = 'referral' AND d.is_active AND v_referrals >= d.threshold
  ON CONFLICT DO NOTHING;

  v_start := COALESCE(v_member.initial_weight,
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date ASC, w.created_at ASC LIMIT 1));
  v_current := COALESCE(
    (SELECT w.weight FROM public.weight_tracking w WHERE w.member_id = p_member_id ORDER BY w.recorded_date DESC, w.created_at DESC LIMIT 1),
    v_member.current_weight);

  IF v_start IS NULL OR v_current IS NULL THEN RETURN; END IF;

  IF v_member.goal = 'weight_gain' THEN
    v_category := 'weight_gain';
    v_delta := v_current - v_start;
  ELSE
    v_category := 'weight_loss';
    v_delta := v_start - v_current;
  END IF;

  IF v_delta <= 0 THEN RETURN; END IF;

  INSERT INTO public.member_achievements(member_id, achievement_id)
  SELECT p_member_id, d.id FROM public.achievement_definitions d
   WHERE d.category = v_category AND d.is_active AND v_delta >= d.threshold
  ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.recalc_all_member_achievements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  FOR r IN SELECT id FROM public.wellness_members LOOP
    PERFORM public.recalc_member_achievements(r.id);
  END LOOP;
END; $$;

-- 5. Triggers driving recalculation
CREATE OR REPLACE FUNCTION public.trg_member_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_member_achievements(NEW.id);
  IF NEW.referred_by_member_id IS NOT NULL THEN
    PERFORM public.recalc_member_achievements(NEW.referred_by_member_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.referred_by_member_id IS NOT NULL
     AND OLD.referred_by_member_id IS DISTINCT FROM NEW.referred_by_member_id THEN
    PERFORM public.recalc_member_achievements(OLD.referred_by_member_id);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS member_achievements_sync ON public.wellness_members;
CREATE TRIGGER member_achievements_sync
AFTER INSERT OR UPDATE OF referred_by_member_id, goal, initial_weight, current_weight, status
ON public.wellness_members
FOR EACH ROW EXECUTE FUNCTION public.trg_member_achievements();

CREATE OR REPLACE FUNCTION public.trg_weight_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_member_achievements(NEW.member_id);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS weight_achievements_sync ON public.weight_tracking;
CREATE TRIGGER weight_achievements_sync
AFTER INSERT OR UPDATE ON public.weight_tracking
FOR EACH ROW EXECUTE FUNCTION public.trg_weight_achievements();

-- 6. Seed milestones
INSERT INTO public.achievement_definitions (category, name, threshold, unit, icon, sort_order) VALUES
  ('referral','Ambassador',2,'people','🏅',1),
  ('referral','Silver Ambassador',5,'people','🥈',2),
  ('referral','Gold Ambassador',7,'people','🥇',3),
  ('referral','Platinum Ambassador',10,'people','🏆',4),
  ('referral','VIP Platinum Ambassador',15,'people','🎖️',5),
  ('referral','Elite Platinum Ambassador',20,'people','⭐',6),
  ('referral','Ruby Ambassador',30,'people','❤️',7),
  ('referral','Topaz Ambassador',40,'people','🟠',8),
  ('referral','Emerald Ambassador',50,'people','💚',9),
  ('referral','Sapphire Ambassador',60,'people','💙',10),
  ('referral','Diamond Ambassador',75,'people','💎',11),
  ('referral','Crown',100,'people','👑',12),
  ('weight_loss','5 kg Lost',5,'kg','🏅',1),
  ('weight_loss','10 kg Lost',10,'kg','🔥',2),
  ('weight_loss','15 kg Lost',15,'kg','🏆',3),
  ('weight_loss','20 kg Lost',20,'kg','💎',4),
  ('weight_loss','25 kg Lost',25,'kg','👑',5),
  ('weight_gain','3 kg Gained',3,'kg','🏅',1),
  ('weight_gain','6 kg Gained',6,'kg','🔥',2),
  ('weight_gain','9 kg Gained',9,'kg','🏆',3),
  ('weight_gain','12 kg Gained',12,'kg','💎',4),
  ('weight_gain','15 kg Gained',15,'kg','👑',5);