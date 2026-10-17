CREATE TYPE public.lead_source AS ENUM ('public_form', 'meta_ads', 'website', 'landing_page', 'manual', 'referral', 'other');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'approved', 'rejected', 'converted');

CREATE TABLE IF NOT EXISTS public.wellness_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  gender text,
  date_of_birth text,
  city text,
  area text,
  goal text DEFAULT 'weight_loss',
  height text,
  joining_weight text,
  health_issues text,
  source public.lead_source NOT NULL DEFAULT 'public_form',
  source_detail text,
  tags text[] DEFAULT '{}',
  status public.lead_status NOT NULL DEFAULT 'new',
  notes text,
  assigned_to uuid,
  converted_member_id uuid REFERENCES public.wellness_members(id) ON DELETE SET NULL,
  converted_trial_id uuid REFERENCES public.wellness_trials(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellness_leads_status ON public.wellness_leads(status);
CREATE INDEX IF NOT EXISTS idx_wellness_leads_created ON public.wellness_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_leads_mobile ON public.wellness_leads(mobile_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_leads TO authenticated;
GRANT ALL ON public.wellness_leads TO service_role;

ALTER TABLE public.wellness_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage leads"
  ON public.wellness_leads FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_trial_lead(
  p_full_name text,
  p_mobile_number text,
  p_gender text DEFAULT NULL,
  p_date_of_birth text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_goal text DEFAULT 'weight_loss',
  p_height text DEFAULT NULL,
  p_joining_weight text DEFAULT NULL,
  p_health_issues text DEFAULT NULL,
  p_source text DEFAULT 'public_form',
  p_source_detail text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_src lead_source;
BEGIN
  IF length(trim(coalesce(p_full_name, ''))) < 2 OR length(trim(p_full_name)) > 120 THEN
    RAISE EXCEPTION 'Name is required (2-120 characters)';
  END IF;
  IF length(regexp_replace(coalesce(p_mobile_number, ''), '\D', '', 'g')) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'A valid mobile number is required (at least 10 digits)';
  END IF;
  BEGIN
    v_src := p_source::lead_source;
  EXCEPTION WHEN invalid_text_representation THEN
    v_src := 'other';
  END;

  INSERT INTO wellness_leads (
    full_name, mobile_number, gender, date_of_birth, city, area,
    goal, height, joining_weight, health_issues, source, source_detail
  ) VALUES (
    trim(p_full_name),
    right(regexp_replace(p_mobile_number, '\D', '', 'g'), 10),
    left(nullif(trim(coalesce(p_gender, '')), ''), 20),
    left(nullif(trim(coalesce(p_date_of_birth, '')), ''), 20),
    left(nullif(trim(coalesce(p_city, '')), ''), 100),
    left(nullif(trim(coalesce(p_area, '')), ''), 100),
    CASE WHEN p_goal IN ('weight_loss', 'weight_gain') THEN p_goal ELSE 'weight_loss' END,
    left(nullif(trim(coalesce(p_height, '')), ''), 10),
    left(nullif(trim(coalesce(p_joining_weight, '')), ''), 10),
    left(nullif(trim(coalesce(p_health_issues, '')), ''), 1000),
    v_src,
    left(nullif(trim(coalesce(p_source_detail, '')), ''), 200)
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_trial_lead(text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_trial_lead(text, text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_lead(
  p_lead_id uuid,
  p_plan_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead wellness_leads;
  v_member_id uuid;
  v_trial_id uuid;
  v_plan_id uuid := p_plan_id;
  v_duration int;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_mobile text;
  v_note text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can approve leads';
  END IF;

  SELECT * INTO v_lead FROM wellness_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF v_lead.status NOT IN ('new', 'contacted') THEN
    RAISE EXCEPTION 'Lead has already been % and cannot be approved', v_lead.status;
  END IF;

  v_mobile := right(regexp_replace(v_lead.mobile_number, '\D', '', 'g'), 10);

  SELECT id INTO v_member_id FROM wellness_members WHERE mobile_number = v_mobile LIMIT 1;
  IF v_member_id IS NOT NULL THEN
    UPDATE wellness_leads
       SET status = 'approved', converted_member_id = v_member_id, updated_at = now()
     WHERE id = p_lead_id;
    RETURN json_build_object(
      'status', 'existing_member',
      'member_id', v_member_id,
      'message', 'This mobile number belongs to an existing member. Lead marked as approved.'
    );
  END IF;

  INSERT INTO wellness_members (
    full_name, mobile_number, gender, date_of_birth,
    goal, height, initial_weight, current_weight,
    status, is_guest, member_mode, activation_code, joining_date, created_by
  ) VALUES (
    v_lead.full_name,
    v_mobile,
    v_lead.gender,
    CASE WHEN v_lead.date_of_birth ~ '^\d{4}-\d{2}-\d{2}$' THEN v_lead.date_of_birth::date ELSE NULL END,
    CASE WHEN v_lead.goal = 'weight_gain' THEN 'weight_gain' ELSE 'weight_loss' END::wellness_goal,
    CASE WHEN v_lead.height ~ '^\d+(\.\d+)?$' THEN v_lead.height::numeric ELSE NULL END,
    CASE WHEN v_lead.joining_weight ~ '^\d+(\.\d+)?$' THEN v_lead.joining_weight::numeric ELSE NULL END,
    CASE WHEN v_lead.joining_weight ~ '^\d+(\.\d+)?$' THEN v_lead.joining_weight::numeric ELSE NULL END,
    'trial', true, 'physical',
    upper(substr(md5(random()::text), 1, 6)),
    v_today,
    auth.uid()
  )
  RETURNING id INTO v_member_id;

  v_note := concat_ws(E'\n',
    CASE WHEN v_lead.city IS NOT NULL OR v_lead.area IS NOT NULL
      THEN 'City/Area: ' || concat_ws(', ', v_lead.area, v_lead.city) END,
    CASE WHEN v_lead.health_issues IS NOT NULL THEN 'Health issues: ' || v_lead.health_issues END,
    CASE WHEN v_lead.notes IS NOT NULL THEN 'Lead notes: ' || v_lead.notes END);
  IF v_note IS NOT NULL AND v_note <> '' THEN
    INSERT INTO member_notes (member_id, note, created_by)
    VALUES (v_member_id, 'From trial lead form' || E'\n' || v_note, auth.uid());
  END IF;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
      FROM wellness_plans
     WHERE plan_type = 'trial' AND price = 0 AND duration_days = 3 AND active = true
     LIMIT 1;
  END IF;
  v_duration := coalesce((SELECT duration_days FROM wellness_plans WHERE id = v_plan_id), 3);

  INSERT INTO wellness_trials (member_id, plan_id, start_date, duration_days, status, created_by)
  VALUES (v_member_id, v_plan_id, v_today, v_duration, 'active', auth.uid())
  RETURNING id INTO v_trial_id;

  UPDATE wellness_leads
     SET status = 'converted', converted_member_id = v_member_id,
         converted_trial_id = v_trial_id, updated_at = now()
   WHERE id = p_lead_id;

  RETURN json_build_object('status', 'ok', 'member_id', v_member_id,
    'trial_id', v_trial_id, 'member_name', v_lead.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_lead(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_lead(uuid, uuid) TO authenticated;
