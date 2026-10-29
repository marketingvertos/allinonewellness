ALTER TABLE public.wellness_leads ADD COLUMN IF NOT EXISTS referred_by_member_id uuid;

DROP FUNCTION IF EXISTS public.submit_trial_lead(text,text,text,text,text,text,text,text,text,text,text,text);
CREATE FUNCTION public.submit_trial_lead(p_full_name text, p_mobile_number text, p_gender text DEFAULT NULL, p_date_of_birth text DEFAULT NULL, p_city text DEFAULT NULL, p_area text DEFAULT NULL, p_goal text DEFAULT 'weight_loss', p_height text DEFAULT NULL, p_joining_weight text DEFAULT NULL, p_health_issues text DEFAULT NULL, p_source text DEFAULT 'public_form', p_source_detail text DEFAULT NULL, p_referred_by_member_id uuid DEFAULT NULL, p_referrer_name text DEFAULT NULL, p_referrer_mobile text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_id uuid;
  v_src lead_source;
  v_ref uuid;
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
  SELECT id INTO v_ref FROM wellness_members WHERE id = p_referred_by_member_id AND coalesce(is_guest,false) = false;

  INSERT INTO wellness_leads (
    full_name, mobile_number, gender, date_of_birth, city, area,
    goal, height, joining_weight, health_issues, source, source_detail,
    referred_by_member_id, referrer_name, referrer_mobile
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
    left(nullif(trim(coalesce(p_source_detail, '')), ''), 200),
    v_ref,
    CASE WHEN v_ref IS NULL THEN left(nullif(trim(coalesce(p_referrer_name, '')), ''), 100) END,
    CASE WHEN v_ref IS NULL THEN left(nullif(regexp_replace(coalesce(p_referrer_mobile, ''), '\D', '', 'g'), ''), 15) END
  )
  RETURNING id INTO v_id;
  RETURN json_build_object('ok', true, 'id', v_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.submit_trial_lead(text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text) TO anon, authenticated;

-- When a lead becomes a member, carry the introducer across (never overwrite an existing one).
CREATE OR REPLACE FUNCTION public.carry_lead_introducer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.converted_member_id IS NOT NULL AND NEW.converted_member_id IS DISTINCT FROM OLD.converted_member_id
     AND (NEW.referred_by_member_id IS NOT NULL OR NEW.referrer_name IS NOT NULL) THEN
    UPDATE wellness_members
       SET referred_by_member_id = NEW.referred_by_member_id,
           referrer_name = CASE WHEN NEW.referred_by_member_id IS NULL THEN NEW.referrer_name END,
           referrer_mobile = CASE WHEN NEW.referred_by_member_id IS NULL THEN NEW.referrer_mobile END
     WHERE id = NEW.converted_member_id
       AND referred_by_member_id IS NULL AND referrer_name IS NULL
       AND id IS DISTINCT FROM NEW.referred_by_member_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_carry_lead_introducer ON public.wellness_leads;
CREATE TRIGGER trg_carry_lead_introducer AFTER UPDATE OF converted_member_id ON public.wellness_leads
FOR EACH ROW EXECUTE FUNCTION public.carry_lead_introducer();