CREATE TABLE public.wellness_centre_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  checkin_code text NOT NULL DEFAULT encode(gen_random_bytes(9), 'hex'),
  code_rotated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wellness_centre_settings_singleton_chk CHECK (singleton)
);

GRANT SELECT, INSERT, UPDATE ON public.wellness_centre_settings TO authenticated;
GRANT ALL ON public.wellness_centre_settings TO service_role;

ALTER TABLE public.wellness_centre_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view centre settings" ON public.wellness_centre_settings
  FOR SELECT TO authenticated USING (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Staff insert centre settings" ON public.wellness_centre_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_wellness_staff(auth.uid()));
CREATE POLICY "Managers rotate centre code" ON public.wellness_centre_settings
  FOR UPDATE TO authenticated USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE TRIGGER update_wellness_centre_settings_updated_at
  BEFORE UPDATE ON public.wellness_centre_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.wellness_centre_settings (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

-- Self check-in from the centre QR code
CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_member_id uuid; v_valid boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM wellness_centre_settings WHERE checkin_code = p_code) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('status','invalid_code','message','This QR code is no longer valid. Please ask the front desk.');
  END IF;

  SELECT id INTO v_member_id FROM wellness_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('status','no_member','message','No member profile is linked to this login.');
  END IF;

  RETURN public.checkin_member(v_member_id, 'qr_scan');
END; $$;

REVOKE ALL ON FUNCTION public.member_self_checkin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_self_checkin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rotate_checkin_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_code text;
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  v_code := encode(gen_random_bytes(9), 'hex');
  UPDATE wellness_centre_settings SET checkin_code = v_code, code_rotated_at = now() WHERE singleton;
  RETURN v_code;
END; $$;

REVOKE ALL ON FUNCTION public.rotate_checkin_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_checkin_code() TO authenticated;

-- Plan delete: hard delete when unused, otherwise deactivate
CREATE OR REPLACE FUNCTION public.delete_wellness_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_refs integer;
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT (SELECT count(*) FROM wellness_memberships WHERE plan_id = p_plan_id)
       + (SELECT count(*) FROM wellness_trials WHERE plan_id = p_plan_id)
  INTO v_refs;

  IF v_refs = 0 THEN
    DELETE FROM wellness_plans WHERE id = p_plan_id;
    RETURN jsonb_build_object('status','deleted');
  END IF;

  UPDATE wellness_plans SET active = false WHERE id = p_plan_id;
  RETURN jsonb_build_object('status','deactivated','references', v_refs);
END; $$;

REVOKE ALL ON FUNCTION public.delete_wellness_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_wellness_plan(uuid) TO authenticated;

-- Plan usage counts for the plans page
CREATE OR REPLACE FUNCTION public.wellness_plan_usage()
RETURNS TABLE(plan_id uuid, usage_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id,
         (SELECT count(*) FROM wellness_memberships m WHERE m.plan_id = p.id)
       + (SELECT count(*) FROM wellness_trials t WHERE t.plan_id = p.id)
  FROM wellness_plans p
  WHERE public.is_wellness_staff(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.wellness_plan_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wellness_plan_usage() TO authenticated;