
-- ============ ENUMS ============
CREATE TYPE public.wellness_status AS ENUM ('lead','trial','active_member','renewal_due','expired','inactive');
CREATE TYPE public.trial_status AS ENUM ('active','completed','expired','converted','cancelled');
CREATE TYPE public.membership_status AS ENUM ('active','expiring_soon','expired','cancelled');
CREATE TYPE public.checkin_method AS ENUM ('qr_scan','barcode_scan','admin_manual','staff_entry');
CREATE TYPE public.serving_txn_type AS ENUM ('membership_allocation','daily_deduction','manual_adjustment','renewal_allocation','refund_adjustment');
CREATE TYPE public.wellness_goal AS ENUM ('weight_loss','fat_loss','weight_management','weight_gain','general_wellness','healthy_lifestyle','body_transformation');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_wellness_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_wellness_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'manager')
$$;

-- ============ wellness_plans ============
CREATE TABLE public.wellness_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'membership',
  duration_days integer NOT NULL DEFAULT 30,
  total_servings integer NOT NULL DEFAULT 30,
  servings_per_day integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_plans TO authenticated;
GRANT ALL ON public.wellness_plans TO service_role;
ALTER TABLE public.wellness_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view plans" ON public.wellness_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage plans" ON public.wellness_plans FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid())) WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_wellness_plans_updated_at BEFORE UPDATE ON public.wellness_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wellness_batches ============
CREATE TABLE public.wellness_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  program_type text,
  start_date date,
  end_date date,
  coach_staff_id uuid,
  max_capacity integer,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_batches TO authenticated;
GRANT ALL ON public.wellness_batches TO service_role;
ALTER TABLE public.wellness_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view batches" ON public.wellness_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage batches" ON public.wellness_batches FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid())) WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_wellness_batches_updated_at BEFORE UPDATE ON public.wellness_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wellness_members ============
CREATE TABLE public.wellness_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  email text,
  gender text,
  date_of_birth date,
  joining_date date NOT NULL DEFAULT current_date,
  status public.wellness_status NOT NULL DEFAULT 'lead',
  goal public.wellness_goal,
  initial_weight numeric,
  current_weight numeric,
  target_weight numeric,
  height numeric,
  activity_level text,
  batch_id uuid REFERENCES public.wellness_batches(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mobile_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_members TO authenticated;
GRANT ALL ON public.wellness_members TO service_role;
ALTER TABLE public.wellness_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view all members" ON public.wellness_members FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Member views own row" ON public.wellness_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Staff insert members" ON public.wellness_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff update members" ON public.wellness_members FOR UPDATE TO authenticated
  USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Member updates own row" ON public.wellness_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Managers delete members" ON public.wellness_members FOR DELETE TO authenticated
  USING (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_wellness_members_updated_at BEFORE UPDATE ON public.wellness_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- restrict member self-update to safe columns
CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT public.is_wellness_staff(auth.uid()) THEN
    IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.current_weight IS DISTINCT FROM OLD.current_weight
      OR NEW.initial_weight IS DISTINCT FROM OLD.initial_weight
      OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'You can only update your own basic profile details.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_wellness_member_self_update BEFORE UPDATE ON public.wellness_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_self_update();

CREATE OR REPLACE FUNCTION public.owns_wellness_member(_user_id uuid, _member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.wellness_members m WHERE m.id = _member_id AND m.user_id = _user_id)
$$;

-- ============ wellness_trials ============
CREATE TABLE public.wellness_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.wellness_plans(id),
  start_date date NOT NULL DEFAULT current_date,
  duration_days integer NOT NULL DEFAULT 3,
  end_date date GENERATED ALWAYS AS ((start_date + duration_days)::date) STORED,
  weight_at_start numeric,
  status public.trial_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_trials TO authenticated;
GRANT ALL ON public.wellness_trials TO service_role;
ALTER TABLE public.wellness_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view trials" ON public.wellness_trials FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "Staff insert trials" ON public.wellness_trials FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Staff update trials" ON public.wellness_trials FOR UPDATE TO authenticated
  USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Managers delete trials" ON public.wellness_trials FOR DELETE TO authenticated
  USING (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_wellness_trials_updated_at BEFORE UPDATE ON public.wellness_trials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wellness_memberships ============
CREATE TABLE public.wellness_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.wellness_plans(id),
  membership_code text NOT NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL,
  total_servings integer NOT NULL,
  used_servings integer NOT NULL DEFAULT 0,
  remaining_servings integer NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active',
  renewed_from uuid REFERENCES public.wellness_memberships(id),
  price_paid numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remaining_not_negative CHECK (remaining_servings >= 0),
  CONSTRAINT remaining_matches CHECK (remaining_servings = total_servings - used_servings)
);
CREATE UNIQUE INDEX one_active_membership_per_member ON public.wellness_memberships (member_id)
  WHERE status IN ('active','expiring_soon');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_memberships TO authenticated;
GRANT ALL ON public.wellness_memberships TO service_role;
ALTER TABLE public.wellness_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view memberships" ON public.wellness_memberships FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "Staff insert memberships" ON public.wellness_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Staff update memberships" ON public.wellness_memberships FOR UPDATE TO authenticated
  USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Admins delete memberships" ON public.wellness_memberships FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_wellness_memberships_updated_at BEFORE UPDATE ON public.wellness_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wellness_attendance ============
CREATE TABLE public.wellness_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.wellness_memberships(id),
  trial_id uuid REFERENCES public.wellness_trials(id),
  visit_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  visit_time timestamptz NOT NULL DEFAULT now(),
  serving_deducted boolean NOT NULL DEFAULT false,
  remaining_balance_snapshot integer,
  checkin_method public.checkin_method NOT NULL DEFAULT 'staff_entry',
  staff_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_checkin_per_member_per_day UNIQUE (member_id, visit_date)
);
GRANT SELECT, INSERT ON public.wellness_attendance TO authenticated;
GRANT ALL ON public.wellness_attendance TO service_role;
ALTER TABLE public.wellness_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view attendance" ON public.wellness_attendance FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));

-- ============ serving_transactions ============
CREATE TABLE public.serving_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.wellness_memberships(id),
  attendance_id uuid REFERENCES public.wellness_attendance(id),
  txn_type public.serving_txn_type NOT NULL,
  change integer NOT NULL,
  balance_after integer NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.serving_transactions TO authenticated;
GRANT ALL ON public.serving_transactions TO service_role;
ALTER TABLE public.serving_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view ledger" ON public.serving_transactions FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "Staff insert ledger" ON public.serving_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = created_by);

-- ============ weight_tracking / body_measurements ============
CREATE TABLE public.weight_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  recorded_date date NOT NULL DEFAULT current_date,
  weight numeric NOT NULL,
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_tracking TO authenticated;
GRANT ALL ON public.weight_tracking TO service_role;
ALTER TABLE public.weight_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view weights" ON public.weight_tracking FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "Staff insert weights" ON public.weight_tracking FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = recorded_by);
CREATE POLICY "Staff update weights" ON public.weight_tracking FOR UPDATE TO authenticated
  USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Managers delete weights" ON public.weight_tracking FOR DELETE TO authenticated
  USING (public.is_wellness_manager(auth.uid()));

CREATE TABLE public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  recorded_date date NOT NULL DEFAULT current_date,
  waist numeric,
  hip numeric,
  chest numeric,
  body_fat_percentage numeric,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT ALL ON public.body_measurements TO service_role;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view measurements" ON public.body_measurements FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "Staff insert measurements" ON public.body_measurements FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = recorded_by);
CREATE POLICY "Staff update measurements" ON public.body_measurements FOR UPDATE TO authenticated
  USING (public.is_wellness_staff(auth.uid())) WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Managers delete measurements" ON public.body_measurements FOR DELETE TO authenticated
  USING (public.is_wellness_manager(auth.uid()));

-- ============ member_notes ============
CREATE TABLE public.member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_notes TO authenticated;
GRANT ALL ON public.member_notes TO service_role;
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view notes" ON public.member_notes FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff insert notes" ON public.member_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_staff(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Author updates notes" ON public.member_notes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Author or manager deletes notes" ON public.member_notes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_wellness_manager(auth.uid()));

-- ============ notification templates + log ============
CREATE TABLE public.wellness_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL,
  channel text NOT NULL,
  message_template text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_notification_templates TO authenticated;
GRANT ALL ON public.wellness_notification_templates TO service_role;
ALTER TABLE public.wellness_notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view templates" ON public.wellness_notification_templates FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Managers manage templates" ON public.wellness_notification_templates FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid())) WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER update_wellness_templates_updated_at BEFORE UPDATE ON public.wellness_notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wellness_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  message text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wellness_notification_log TO authenticated;
GRANT ALL ON public.wellness_notification_log TO service_role;
ALTER TABLE public.wellness_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view notification log" ON public.wellness_notification_log FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));

-- ============ BUSINESS LOGIC ============
CREATE OR REPLACE FUNCTION public.checkin_member(p_member_id uuid, p_method public.checkin_method DEFAULT 'staff_entry')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_membership record;
  v_trial record;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_attendance_id uuid;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized to check in this member.';
  END IF;

  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = p_member_id AND visit_date = v_today) THEN
    RETURN jsonb_build_object('status','duplicate','message','Already checked in today.');
  END IF;

  SELECT * INTO v_trial FROM wellness_trials
  WHERE member_id = p_member_id AND status = 'active' AND end_date >= v_today LIMIT 1;
  IF FOUND THEN
    INSERT INTO wellness_attendance(member_id, trial_id, checkin_method, serving_deducted, staff_id)
    VALUES (p_member_id, v_trial.id, p_method, false, auth.uid());
    RETURN jsonb_build_object('status','ok','mode','trial');
  END IF;

  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = p_member_id AND status IN ('active','expiring_soon') LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_active_plan','message','No active trial or membership.');
  END IF;
  IF v_membership.remaining_servings <= 0 THEN
    RETURN jsonb_build_object('status','exhausted','message','Serving balance exhausted. Please renew.');
  END IF;

  INSERT INTO wellness_attendance(member_id, membership_id, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id)
  VALUES (p_member_id, v_membership.id, p_method, true, v_membership.remaining_servings - 1, auth.uid())
  RETURNING id INTO v_attendance_id;

  UPDATE wellness_memberships
  SET used_servings = used_servings + 1, remaining_servings = remaining_servings - 1
  WHERE id = v_membership.id;

  INSERT INTO serving_transactions(member_id, membership_id, attendance_id, txn_type, change, balance_after, created_by)
  VALUES (p_member_id, v_membership.id, v_attendance_id, 'daily_deduction', -1, v_membership.remaining_servings - 1, COALESCE(auth.uid(), v_membership.created_by));

  RETURN jsonb_build_object('status','ok','mode','membership','remaining', v_membership.remaining_servings - 1);
END; $$;

CREATE OR REPLACE FUNCTION public.convert_trial_to_membership(p_trial_id uuid, p_plan_id uuid, p_price numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trial record; v_plan record; v_membership_id uuid; v_code text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_trial FROM wellness_trials WHERE id = p_trial_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, price_paid, created_by)
  VALUES (v_trial.member_id, p_plan_id, v_code, current_date, (current_date + v_plan.duration_days)::date,
    v_plan.total_servings, 0, v_plan.total_servings, 'active', COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_membership_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_trial.member_id, v_membership_id, 'membership_allocation', v_plan.total_servings, v_plan.total_servings, auth.uid(), 'Converted from trial');

  UPDATE wellness_trials SET status = 'converted' WHERE id = p_trial_id;
  UPDATE wellness_members SET status = 'active_member' WHERE id = v_trial.member_id;

  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_trial.member_id, 'membership_activated', 'whatsapp');

  RETURN v_membership_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_membership(p_member_id uuid, p_plan_id uuid, p_price numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan record; v_membership_id uuid; v_code text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, price_paid, created_by)
  VALUES (p_member_id, p_plan_id, v_code, current_date, (current_date + v_plan.duration_days)::date,
    v_plan.total_servings, 0, v_plan.total_servings, 'active', COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_membership_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by)
  VALUES (p_member_id, v_membership_id, 'membership_allocation', v_plan.total_servings, v_plan.total_servings, auth.uid());

  UPDATE wellness_members SET status = 'active_member' WHERE id = p_member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (p_member_id, 'membership_activated', 'whatsapp');
  RETURN v_membership_id;
END; $$;

CREATE OR REPLACE FUNCTION public.renew_membership(p_membership_id uuid, p_plan_id uuid DEFAULT NULL, p_price numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record; v_plan record; v_new_id uuid; v_code text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = COALESCE(p_plan_id, v_old.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;

  v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');
  INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
    total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by)
  VALUES (v_old.member_id, v_plan.id, v_code, current_date, (current_date + v_plan.duration_days)::date,
    v_plan.total_servings, 0, v_plan.total_servings, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid())
  RETURNING id INTO v_new_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_old.member_id, v_new_id, 'renewal_allocation', v_plan.total_servings, v_plan.total_servings, auth.uid(), 'Renewal');

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_old.member_id, 'membership_renewed', 'whatsapp');
  RETURN v_new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_servings(p_membership_id uuid, p_change integer, p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m record; v_new integer;
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_m FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  v_new := v_m.remaining_servings + p_change;
  IF v_new < 0 THEN RAISE EXCEPTION 'Adjustment would make balance negative.'; END IF;

  UPDATE wellness_memberships
  SET remaining_servings = v_new,
      total_servings = GREATEST(v_m.total_servings + GREATEST(p_change,0), used_servings + v_new),
      used_servings = (GREATEST(v_m.total_servings + GREATEST(p_change,0), v_m.used_servings + v_new)) - v_new
  WHERE id = p_membership_id;

  INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
  VALUES (v_m.member_id, p_membership_id, 'manual_adjustment', p_change, v_new, auth.uid(), p_note);
  RETURN v_new;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  UPDATE wellness_trials SET status = 'expired' WHERE status = 'active' AND end_date < v_today;
  UPDATE wellness_memberships SET status = 'expired' WHERE status IN ('active','expiring_soon') AND end_date < v_today;
  UPDATE wellness_memberships SET status = 'expiring_soon'
    WHERE status = 'active' AND (end_date - v_today) <= 5 AND end_date >= v_today;
  UPDATE wellness_members m SET status = 'expired'
    WHERE m.status IN ('active_member','renewal_due')
      AND NOT EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status IN ('active','expiring_soon'));
  UPDATE wellness_members m SET status = 'renewal_due'
    WHERE m.status = 'active_member'
      AND EXISTS (SELECT 1 FROM wellness_memberships ms WHERE ms.member_id = m.id AND ms.status = 'expiring_soon');
END; $$;

CREATE OR REPLACE FUNCTION public.queue_serving_threshold_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.remaining_servings < OLD.remaining_servings AND NEW.remaining_servings <= 5 THEN
    INSERT INTO public.wellness_notification_log(member_id, trigger_key, channel)
    VALUES (NEW.member_id, 'serving_balance_' || NEW.remaining_servings::text, 'whatsapp');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER queue_serving_threshold AFTER UPDATE ON public.wellness_memberships
  FOR EACH ROW EXECUTE FUNCTION public.queue_serving_threshold_notification();

-- ============ handle_new_user guard ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'account_type') = 'wellness_member' THEN
    UPDATE public.wellness_members
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND mobile_number = COALESCE(NEW.phone, NEW.raw_user_meta_data->>'mobile_number');
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rep');
  RETURN NEW;
END;
$$;
