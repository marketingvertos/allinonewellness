CREATE OR REPLACE FUNCTION public.convert_guest_to_paid_trial(p_trial_id uuid, p_plan_id uuid, p_payment_mode text DEFAULT 'cash'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_t record; v_plan record; v_new uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_t FROM wellness_trials WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  IF v_t.status IN ('converted','cancelled') THEN RAISE EXCEPTION 'This trial has already been converted.'; END IF;
  IF v_t.plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM wellness_plans WHERE id = v_t.plan_id AND plan_type = 'trial' AND price > 0) THEN
    RAISE EXCEPTION 'This member is already on a paid trial. Convert to a membership, or use Change trial.';
  END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id AND plan_type = 'trial' AND price > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paid trial plan not found.'; END IF;

  UPDATE wellness_trials SET status = 'converted' WHERE id = p_trial_id;
  INSERT INTO wellness_trials(member_id, plan_id, start_date, duration_days, weight_at_start, status, created_by)
  VALUES (v_t.member_id, p_plan_id, current_date, v_plan.duration_days, v_t.weight_at_start, 'active', auth.uid())
  RETURNING id INTO v_new;
  UPDATE wellness_members SET status = 'trial' WHERE id = v_t.member_id;
  INSERT INTO member_notes(member_id, note, created_by)
  VALUES (v_t.member_id, 'Guest trial converted to ' || v_plan.name || ' (₹' || v_plan.price::int || ', ' || COALESCE(p_payment_mode,'cash') || ')', auth.uid());
  RETURN v_new;
END; $function$;