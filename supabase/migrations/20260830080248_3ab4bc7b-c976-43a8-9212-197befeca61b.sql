ALTER TABLE public.wellness_checkin_requests ADD COLUMN IF NOT EXISTS requested_weight numeric;

CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text, p_weight numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_valid boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_membership uuid;
  v_request public.wellness_checkin_requests;
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

  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_member_id AND visit_date = v_today) THEN
    RETURN jsonb_build_object('status','duplicate','message','Your visit is already recorded for today.');
  END IF;

  SELECT * INTO v_request FROM wellness_checkin_requests
  WHERE member_id = v_member_id AND request_date = v_today AND status = 'pending' LIMIT 1;
  IF FOUND THEN
    IF p_weight IS NOT NULL THEN
      UPDATE wellness_checkin_requests SET requested_weight = p_weight WHERE id = v_request.id;
    END IF;
    RETURN jsonb_build_object('status','pending','request_id', v_request.id,
      'message','Your check-in request is waiting for approval at the front desk.');
  END IF;

  SELECT id INTO v_membership FROM wellness_memberships
  WHERE member_id = v_member_id AND status IN ('active','expiring_soon') LIMIT 1;

  INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
  VALUES (v_member_id, v_membership, v_today, p_weight)
  RETURNING * INTO v_request;

  RETURN jsonb_build_object('status','pending','request_id', v_request.id,
    'message','Your check-in request has been sent for approval.');
END; $function$;

CREATE OR REPLACE FUNCTION public.approve_checkin_request(p_request_id uuid, p_weight numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.wellness_checkin_requests;
  v_result jsonb;
  v_attendance uuid;
  v_weight numeric;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to approve check-ins.';
  END IF;

  SELECT * INTO v_req FROM wellness_checkin_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found','message','Request not found.');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('status','already_decided','message','This request was already handled.');
  END IF;

  v_result := public.checkin_member(v_req.member_id, 'qr_scan');

  IF v_result->>'status' <> 'ok' THEN
    RETURN v_result;
  END IF;

  SELECT id INTO v_attendance FROM wellness_attendance
  WHERE member_id = v_req.member_id
  ORDER BY visit_time DESC LIMIT 1;

  UPDATE wellness_checkin_requests
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(), attendance_id = v_attendance,
      requested_weight = COALESCE(p_weight, requested_weight)
  WHERE id = p_request_id;

  v_weight := COALESCE(p_weight, v_req.requested_weight);
  IF v_weight IS NOT NULL AND v_weight > 0 THEN
    BEGIN
      INSERT INTO public.weight_tracking(member_id, recorded_date, weight, recorded_by, notes)
      VALUES (v_req.member_id, v_today, v_weight, auth.uid(), 'Recorded at check-in');
      UPDATE public.wellness_members SET current_weight = v_weight WHERE id = v_req.member_id;
      v_result := v_result || jsonb_build_object('weight_recorded', v_weight);
    EXCEPTION WHEN OTHERS THEN
      v_result := v_result || jsonb_build_object('weight_error', true);
    END;
  END IF;

  RETURN v_result;
END; $function$;