CREATE OR REPLACE FUNCTION public.trial_is_paid3(p_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p_plan_id IS NOT NULL AND EXISTS (SELECT 1 FROM wellness_plans p WHERE p.id = p_plan_id
    AND p.plan_type = 'trial' AND p.price > 0 AND p.total_servings = 3);
$$;

CREATE OR REPLACE FUNCTION public.reverse_trial_pink_card(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ref uuid; v_net int; v_bal int;
BEGIN
  SELECT referred_by_member_id INTO v_ref FROM wellness_members WHERE id = p_member_id;
  IF v_ref IS NULL OR v_ref = p_member_id THEN RETURN; END IF;
  SELECT COALESCE(SUM(change),0) INTO v_net FROM pink_card_ledger
   WHERE referred_member_id = p_member_id AND member_id = v_ref
     AND (reason = 'trial_referral' OR (reason = 'referral_reversal' AND note = 'trial_referral'));
  IF v_net <= 0 THEN RETURN; END IF;
  UPDATE wellness_members SET pink_card_balance = pink_card_balance - v_net WHERE id = v_ref RETURNING pink_card_balance INTO v_bal;
  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, referred_member_id, note, created_by)
  VALUES (v_ref, -v_net, v_bal, 'referral_reversal', p_member_id, 'trial_referral', auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.change_trial_plan(p_trial_id uuid, p_plan_id uuid, p_duration_days integer, p_payment_mode text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t record; v_plan record; v_dur int; v_serv int; v_used int; v_end date;
  v_old_label text; v_new_label text; v_old_paid boolean; v_new_paid boolean;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_t FROM wellness_trials WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  IF v_t.status IN ('converted','cancelled') THEN RAISE EXCEPTION 'This trial has already been converted or cancelled.'; END IF;

  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id AND plan_type = 'trial';
    IF NOT FOUND THEN RAISE EXCEPTION 'Trial plan not found.'; END IF;
    v_dur := v_plan.duration_days; v_serv := v_plan.total_servings;
    v_new_label := v_plan.name || CASE WHEN v_plan.price > 0 THEN ' (₹' || v_plan.price::int || ')' ELSE '' END;
  ELSE
    IF p_duration_days NOT IN (1,3) THEN RAISE EXCEPTION 'Free trials are 1 or 3 days.'; END IF;
    v_dur := p_duration_days; v_serv := p_duration_days;
    v_new_label := p_duration_days || '-day free trial';
  END IF;

  SELECT count(*) INTO v_used FROM wellness_attendance WHERE trial_id = p_trial_id;
  IF v_used > v_serv THEN
    RAISE EXCEPTION 'This guest has already used % visits; the new plan allows only %.', v_used, v_serv;
  END IF;

  SELECT COALESCE((SELECT name FROM wellness_plans WHERE id = v_t.plan_id), v_t.duration_days || '-day free trial') INTO v_old_label;
  v_old_paid := public.trial_is_paid3(v_t.plan_id);
  v_new_paid := public.trial_is_paid3(p_plan_id);
  v_end := v_t.start_date + v_dur;

  UPDATE wellness_trials SET plan_id = p_plan_id, duration_days = v_dur, end_date = v_end,
    status = CASE WHEN v_end >= current_date THEN 'active'::trial_status ELSE status END
  WHERE id = p_trial_id;

  IF v_new_paid AND NOT v_old_paid THEN
    PERFORM public.award_pink_card(v_t.member_id, 1, 'trial_referral', p_trial_id);
  ELSIF v_old_paid AND NOT v_new_paid THEN
    PERFORM public.reverse_trial_pink_card(v_t.member_id);
  END IF;

  INSERT INTO member_notes(member_id, note, created_by)
  VALUES (v_t.member_id, 'Trial plan changed: ' || v_old_label || ' → ' || v_new_label
    || CASE WHEN p_payment_mode IS NOT NULL AND p_plan_id IS NOT NULL THEN ' · paid by ' || p_payment_mode ELSE '' END,
    auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.convert_guest_to_paid_trial(p_trial_id uuid, p_plan_id uuid, p_payment_mode text DEFAULT 'cash')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t record; v_plan record; v_new uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_t FROM wellness_trials WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trial not found.'; END IF;
  IF v_t.status IN ('converted','cancelled') THEN RAISE EXCEPTION 'This trial has already been converted.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = p_plan_id AND plan_type = 'trial' AND price > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paid trial plan not found.'; END IF;

  UPDATE wellness_trials SET status = 'converted' WHERE id = p_trial_id;
  INSERT INTO wellness_trials(member_id, plan_id, start_date, duration_days, end_date, weight_at_start, status, created_by)
  VALUES (v_t.member_id, p_plan_id, current_date, v_plan.duration_days, current_date + v_plan.duration_days,
          v_t.weight_at_start, 'active', auth.uid())
  RETURNING id INTO v_new;
  UPDATE wellness_members SET status = 'trial' WHERE id = v_t.member_id;
  INSERT INTO member_notes(member_id, note, created_by)
  VALUES (v_t.member_id, 'Guest trial converted to ' || v_plan.name || ' (₹' || v_plan.price::int || ', ' || COALESCE(p_payment_mode,'cash') || ')', auth.uid());
  RETURN v_new;
END; $$;

REVOKE ALL ON FUNCTION public.change_trial_plan(uuid,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_guest_to_paid_trial(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_trial_pink_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_trial_plan(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_guest_to_paid_trial(uuid,uuid,text) TO authenticated;