-- Lead source enum (extensible for future integrations)
CREATE TYPE public.lead_source AS ENUM (
  'public_form', 'meta_ads', 'website', 'landing_page', 'manual', 'referral', 'other'
);

-- Lead status enum
CREATE TYPE public.lead_status AS ENUM (
  'new', 'contacted', 'approved', 'rejected', 'converted'
);

-- Leads table
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
  converted_member_id uuid REFERENCES public.wellness_members(id),
  converted_trial_id uuid REFERENCES public.wellness_trials(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellness_leads_status ON public.wellness_leads(status);
CREATE INDEX IF NOT EXISTS idx_wellness_leads_created ON public.wellness_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_leads_mobile ON public.wellness_leads(mobile_number);

GRANT INSERT ON public.wellness_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_leads TO authenticated;
GRANT ALL ON public.wellness_leads TO service_role;

ALTER TABLE public.wellness_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit leads"
  ON public.wellness_leads FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Staff manage leads"
  ON public.wellness_leads FOR ALL TO authenticated
  USING (public.is_wellness_staff(auth.uid()))
  WITH CHECK (public.is_wellness_staff(auth.uid()));

-- submit_trial_lead — callable by anon (public form) and authenticated
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
  v_lead wellness_leads;
  v_src lead_source;
BEGIN
  IF length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required (at least 2 characters)';
  END IF;

  IF length(regexp_replace(p_mobile_number, '\D', '', 'g')) < 10 THEN
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
    trim(p_mobile_number),
    nullif(trim(coalesce(p_gender, '')), ''),
    nullif(trim(coalesce(p_date_of_birth, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_area, '')), ''),
    coalesce(nullif(trim(coalesce(p_goal, '')), ''), 'weight_loss'),
    nullif(trim(coalesce(p_height, '')), ''),
    nullif(trim(coalesce(p_joining_weight, '')), ''),
    nullif(trim(coalesce(p_health_issues, '')), ''),
    v_src,
    nullif(trim(coalesce(p_source_detail, '')), '')
  )
  RETURNING * INTO v_lead;

  RETURN json_build_object('ok', true, 'id', v_lead.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_trial_lead TO anon;
GRANT EXECUTE ON FUNCTION public.submit_trial_lead TO authenticated;

-- approve_lead — staff only, creates guest member + starts free trial
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
  v_activation_code text;
  v_duration int;
BEGIN
  SELECT * INTO v_lead FROM wellness_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF v_lead.status NOT IN ('new', 'contacted') THEN
    RAISE EXCEPTION 'Lead has already been % and cannot be approved', v_lead.status;
  END IF;

  -- Check if mobile already exists
  SELECT id INTO v_member_id
    FROM wellness_members
   WHERE mobile_number = regexp_replace(v_lead.mobile_number, '\D', '', 'g')
   LIMIT 1;

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

  v_activation_code := upper(substr(md5(random()::text), 1, 6));

  INSERT INTO wellness_members (
    full_name, mobile_number, gender, date_of_birth, city,
    goal, height, initial_weight, health_issues,
    status, is_guest, member_mode, activation_code, joining_date, created_by
  ) VALUES (
    v_lead.full_name,
    regexp_replace(v_lead.mobile_number, '\D', '', 'g'),
    v_lead.gender,
    CASE WHEN v_lead.date_of_birth ~ '^\d{4}-\d{2}-\d{2}$' THEN v_lead.date_of_birth::date ELSE NULL END,
    v_lead.city,
    coalesce(v_lead.goal, 'weight_loss')::wellness_goal,
    CASE WHEN v_lead.height ~ '^\d+\.?\d*$' THEN v_lead.height::numeric ELSE NULL END,
    CASE WHEN v_lead.joining_weight ~ '^\d+\.?\d*$' THEN v_lead.joining_weight::numeric ELSE NULL END,
    v_lead.health_issues,
    'trial', true, 'physical', v_activation_code,
    (now() AT TIME ZONE 'Asia/Kolkata')::date,
    auth.uid()
  )
  RETURNING id INTO v_member_id;

  -- Find a free 3-day trial plan if none specified
  IF p_plan_id IS NULL THEN
    SELECT id INTO p_plan_id
      FROM wellness_plans
     WHERE plan_type = 'trial' AND price = 0 AND duration_days = 3 AND is_active = true
     LIMIT 1;
  END IF;

  v_duration := coalesce((SELECT duration_days FROM wellness_plans WHERE id = p_plan_id), 3);

  INSERT INTO wellness_trials (
    member_id, plan_id, start_date, duration_days,
    end_date, status, created_by
  ) VALUES (
    v_member_id, p_plan_id,
    (now() AT TIME ZONE 'Asia/Kolkata')::date,
    v_duration,
    (now() AT TIME ZONE 'Asia/Kolkata')::date + v_duration - 1,
    'active', auth.uid()
  )
  RETURNING id INTO v_trial_id;

  UPDATE wellness_leads
     SET status = 'converted',
         converted_member_id = v_member_id,
         converted_trial_id = v_trial_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN json_build_object(
    'status', 'ok',
    'member_id', v_member_id,
    'trial_id', v_trial_id,
    'member_name', v_lead.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_lead TO authenticated;
