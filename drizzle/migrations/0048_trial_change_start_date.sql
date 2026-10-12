-- Allow staff to set a custom start date when changing or converting a trial plan.
-- Fixes: changing a free trial to a paid trial recalculated end_date from the
-- original (possibly expired) start_date, making the trial appear ended.

DROP FUNCTION IF EXISTS public.change_trial_plan(uuid, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.change_trial_plan(
  p_trial_id uuid,
  p_plan_id uuid,
  p_duration_days integer,
  p_payment_mode text DEFAULT NULL,
  p_start_date date DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t record; v_plan record; v_dur int; v_serv int; v_used int;
  v_start date; v_end date;
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

  -- Use custom start date if provided, otherwise keep original
  v_start := COALESCE(p_start_date, v_t.start_date);
  v_end := v_start + v_dur;

  UPDATE wellness_trials SET plan_id = p_plan_id, duration_days = v_dur,
    start_date = v_start, end_date = v_end,
    status = CASE WHEN v_end >= current_date THEN 'active'::trial_status ELSE status END
  WHERE id = p_trial_id;

  IF v_new_paid AND NOT v_old_paid THEN
    PERFORM public.award_pink_card(v_t.member_id, 1, 'trial_referral', p_trial_id);
  ELSIF v_old_paid AND NOT v_new_paid THEN
    PERFORM public.reverse_trial_pink_card(v_t.member_id);
  END IF;

  INSERT INTO member_notes(member_id, note, created_by)
  VALUES (v_t.member_id, 'Trial plan changed: ' || v_old_label || ' → ' || v_new_label
    || CASE WHEN v_start <> v_t.start_date THEN ' · new start ' || v_start::text ELSE '' END
    || CASE WHEN p_payment_mode IS NOT NULL AND p_plan_id IS NOT NULL THEN ' · paid by ' || p_payment_mode ELSE '' END,
    auth.uid());
END; $$;

REVOKE ALL ON FUNCTION public.change_trial_plan(uuid,uuid,integer,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_trial_plan(uuid,uuid,integer,text,date) TO authenticated;