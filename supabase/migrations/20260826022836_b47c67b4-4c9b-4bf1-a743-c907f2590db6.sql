CREATE TABLE public.wellness_checkin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.wellness_memberships(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  request_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  reject_reason text,
  attendance_id uuid REFERENCES public.wellness_attendance(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.wellness_checkin_requests TO authenticated;
GRANT ALL ON public.wellness_checkin_requests TO service_role;

ALTER TABLE public.wellness_checkin_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own checkin requests"
ON public.wellness_checkin_requests FOR SELECT TO authenticated
USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));

CREATE POLICY "Staff manage checkin requests"
ON public.wellness_checkin_requests FOR UPDATE TO authenticated
USING (public.is_wellness_staff(auth.uid()))
WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Staff insert checkin requests"
ON public.wellness_checkin_requests FOR INSERT TO authenticated
WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE UNIQUE INDEX wellness_checkin_requests_pending_unique
ON public.wellness_checkin_requests (member_id, request_date)
WHERE status = 'pending';

CREATE INDEX wellness_checkin_requests_status_idx
ON public.wellness_checkin_requests (status, requested_at DESC);

CREATE TRIGGER update_wellness_checkin_requests_updated_at
BEFORE UPDATE ON public.wellness_checkin_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member self check-in now only queues a request
CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text)
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
    RETURN jsonb_build_object('status','pending','request_id', v_request.id,
      'message','Your check-in request is waiting for approval at the front desk.');
  END IF;

  SELECT id INTO v_membership FROM wellness_memberships
  WHERE member_id = v_member_id AND status IN ('active','expiring_soon') LIMIT 1;

  INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date)
  VALUES (v_member_id, v_membership, v_today)
  RETURNING * INTO v_request;

  RETURN jsonb_build_object('status','pending','request_id', v_request.id,
    'message','Your check-in request has been sent for approval.');
END; $function$;

CREATE OR REPLACE FUNCTION public.approve_checkin_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.wellness_checkin_requests;
  v_result jsonb;
  v_attendance uuid;
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
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(), attendance_id = v_attendance
  WHERE id = p_request_id;

  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.reject_checkin_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to reject check-ins.';
  END IF;

  UPDATE wellness_checkin_requests
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), reject_reason = p_reason
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','already_decided','message','This request was already handled.');
  END IF;

  RETURN jsonb_build_object('status','rejected');
END; $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_checkin_requests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.wellness_checkin_requests
  SET status = 'expired', decided_at = now()
  WHERE status = 'pending'
    AND request_date < (now() AT TIME ZONE 'Asia/Kolkata')::date;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.wellness_checkin_requests;
ALTER TABLE public.wellness_checkin_requests REPLICA IDENTITY FULL;