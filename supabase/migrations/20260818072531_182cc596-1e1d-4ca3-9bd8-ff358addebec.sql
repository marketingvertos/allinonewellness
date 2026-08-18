ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS activation_code text NOT NULL DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 6));

CREATE OR REPLACE FUNCTION public.claim_member_account(p_mobile text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_digits text; v_member record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  v_digits := right(regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g'), 10);
  IF length(v_digits) <> 10 THEN
    RETURN jsonb_build_object('status','invalid','message','Enter a valid 10-digit mobile number.');
  END IF;

  SELECT * INTO v_member FROM public.wellness_members
  WHERE right(regexp_replace(mobile_number, '\D', '', 'g'), 10) = v_digits
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found','message','This mobile number is not registered at the centre.');
  END IF;

  IF v_member.user_id IS NOT NULL AND v_member.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('status','already_linked','message','This membership is already linked to another login.');
  END IF;

  IF upper(COALESCE(p_code,'')) <> upper(v_member.activation_code) THEN
    RETURN jsonb_build_object('status','bad_code','message','Activation code does not match. Please check with the front desk.');
  END IF;

  UPDATE public.wellness_members SET user_id = auth.uid() WHERE id = v_member.id;
  RETURN jsonb_build_object('status','ok','member_id', v_member.id);
END; $$;

REVOKE ALL ON FUNCTION public.claim_member_account(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_member_account(text, text) TO authenticated;