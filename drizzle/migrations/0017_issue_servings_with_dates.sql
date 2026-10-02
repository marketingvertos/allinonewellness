DROP FUNCTION IF EXISTS public.issue_servings(uuid, integer, text);
CREATE OR REPLACE FUNCTION public.issue_servings(p_membership_id uuid, p_quantity integer, p_reason text DEFAULT 'Packed for member', p_dates date[] DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_membership record; v_new_balance integer; v_date date; v_note text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised to issue servings'; END IF;
  SELECT * INTO v_membership FROM public.wellness_memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;
  IF v_membership.remaining_servings < p_quantity THEN
    RAISE EXCEPTION 'Not enough servings remaining. Available: %, Requested: %', v_membership.remaining_servings, p_quantity;
  END IF;
  IF p_dates IS NOT NULL AND cardinality(p_dates) > 0 THEN
    IF cardinality(p_dates) <> p_quantity THEN RAISE EXCEPTION 'Pick one date per serving'; END IF;
    IF (SELECT count(DISTINCT d) FROM unnest(p_dates) d) <> cardinality(p_dates) THEN RAISE EXCEPTION 'Dates must be different'; END IF;
  END IF;
  v_new_balance := v_membership.remaining_servings - p_quantity;
  UPDATE public.wellness_memberships SET remaining_servings = v_new_balance, used_servings = used_servings + p_quantity, updated_at = now()
  WHERE id = p_membership_id;
  v_note := COALESCE(NULLIF(TRIM(p_reason), ''), 'Packed for member');
  INSERT INTO public.serving_transactions (membership_id, member_id, change, balance_after, txn_type, note, created_by)
  VALUES (p_membership_id, v_membership.member_id, -p_quantity, v_new_balance, 'pack_and_issue', v_note, auth.uid());
  IF p_dates IS NOT NULL THEN
    FOREACH v_date IN ARRAY p_dates LOOP
      INSERT INTO public.wellness_attendance (member_id, membership_id, visit_date, visit_time, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id)
      VALUES (v_membership.member_id, p_membership_id, v_date, (v_date::text || ' 09:00:00+05:30')::timestamptz, 'serving_issue', true, v_new_balance, auth.uid())
      ON CONFLICT (member_id, visit_date) DO NOTHING;
    END LOOP;
  END IF;
  RETURN v_new_balance;
END; $function$;
GRANT EXECUTE ON FUNCTION public.issue_servings(uuid, integer, text, date[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_checkin_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.checkin_method = 'serving_issue' THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.wellness_notification_log l
    WHERE l.member_id = NEW.member_id AND l.trigger_key = 'checkin_approved'
      AND (l.created_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
  ) THEN
    INSERT INTO public.wellness_notification_log(member_id, trigger_key, channel) VALUES (NEW.member_id, 'checkin_approved', 'whatsapp');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.checkin_member(p_member_id uuid, p_method checkin_method DEFAULT 'staff_entry'::checkin_method)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_membership record;
  v_trial record;
  v_member record;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_attendance_id uuid;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized to check in this member.';
  END IF;

  SELECT * INTO v_member FROM wellness_members WHERE id = p_member_id;

  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = p_member_id AND visit_date = v_today AND checkin_method = 'serving_issue') THEN
    RETURN jsonb_build_object('status','duplicate','message','Serving already issued (packed) for today.');
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
  WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
  ORDER BY end_date LIMIT 1;

  IF NOT FOUND OR v_membership.remaining_servings <= 0 OR v_membership.end_date < v_today THEN
    PERFORM public.activate_next_membership(p_member_id);
    SELECT * INTO v_membership FROM wellness_memberships
    WHERE member_id = p_member_id AND status IN ('active','expiring_soon')
    ORDER BY end_date LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    IF COALESCE(v_member.is_guest, false) THEN
      RETURN jsonb_build_object('status','trial_ended','message','This free guest trial has ended. Please take a membership — contact your coach.');
    END IF;
    RETURN jsonb_build_object('status','renew_required','message','Your membership has ended. Please renew — contact your coach.');
  END IF;
  IF v_membership.remaining_servings <= 0 THEN
    RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
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
END; $function$;

CREATE OR REPLACE FUNCTION public.member_self_checkin(p_code text, p_weight numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_member_id uuid;
  v_valid boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_membership record;
  v_has_trial boolean;
  v_request public.wellness_checkin_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM wellness_centre_settings WHERE checkin_code = p_code) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('status','invalid_code','message','This QR code is no longer valid. Please ask the front desk.');
  END IF;

  SELECT * INTO v_member FROM wellness_members WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','no_member','message','No member profile is linked to this login.');
  END IF;
  v_member_id := v_member.id;

  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = v_member_id AND visit_date = v_today AND checkin_method = 'serving_issue') THEN
    RETURN jsonb_build_object('status','duplicate','message','Your serving for today was already issued (packed).');
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

  SELECT EXISTS (
    SELECT 1 FROM wellness_trials
    WHERE member_id = v_member_id AND status = 'active' AND end_date >= v_today
  ) INTO v_has_trial;

  SELECT * INTO v_membership FROM wellness_memberships
  WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND end_date >= v_today
  ORDER BY end_date LIMIT 1;

  IF NOT v_has_trial THEN
    IF v_membership.id IS NULL THEN
      PERFORM public.activate_next_membership(v_member_id);
      SELECT * INTO v_membership FROM wellness_memberships
      WHERE member_id = v_member_id AND status IN ('active','expiring_soon') AND end_date >= v_today
      ORDER BY end_date LIMIT 1;
    END IF;

    IF v_membership.id IS NULL THEN
      IF COALESCE(v_member.is_guest, false) THEN
        RETURN jsonb_build_object('status','trial_ended','message','Your free guest trial has ended. Please take a membership — contact your coach.');
      END IF;
      RETURN jsonb_build_object('status','renew_required','message','Your membership has ended. Please renew — contact your coach.');
    END IF;

    IF v_membership.remaining_servings <= 0 THEN
      RETURN jsonb_build_object('status','renew_required','message','No servings left on your plan. Please renew — contact your coach.');
    END IF;
  END IF;

  INSERT INTO wellness_checkin_requests(member_id, membership_id, request_date, requested_weight)
  VALUES (v_member_id, v_membership.id, v_today, p_weight)
  RETURNING * INTO v_request;

  RETURN jsonb_build_object('status','pending','request_id', v_request.id,
    'message','Your check-in request has been sent for approval.');
END; $function$;