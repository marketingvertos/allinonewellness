CREATE OR REPLACE FUNCTION public.renew_membership_v2(
  p_membership_id uuid,
  p_plan_id uuid,
  p_servings integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_mode text DEFAULT 'queue',
  p_note text DEFAULT NULL,
  p_payment_mode text DEFAULT 'cash',
  p_payment_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old record; v_plan record; v_servings integer; v_new_id uuid; v_code text;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_pay_date date;
  v_is_early boolean;
  v_bonus integer := 2;
  v_balance integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF p_mode NOT IN ('queue','extend','replace') THEN RAISE EXCEPTION 'Invalid renewal mode.'; END IF;

  v_pay_date := COALESCE(p_payment_date, v_today);

  SELECT * INTO v_old FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;
  SELECT * INTO v_plan FROM wellness_plans WHERE id = COALESCE(p_plan_id, v_old.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.'; END IF;

  v_servings := GREATEST(COALESCE(p_servings, v_plan.total_servings), 0);
  v_is_early := (v_today <= v_old.end_date);

  IF p_mode = 'extend' THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_servings,
           remaining_servings = remaining_servings + v_servings,
           end_date = (GREATEST(end_date, v_today) + v_plan.duration_days)::date,
           status = 'active',
           payment_mode = COALESCE(p_payment_mode, 'cash'),
           payment_date = v_pay_date
     WHERE id = p_membership_id
     RETURNING id INTO v_new_id;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    SELECT member_id, id, 'renewal_allocation', v_servings, remaining_servings, auth.uid(), COALESCE(p_note,'Added to current plan')
      FROM wellness_memberships WHERE id = p_membership_id;
  ELSE
    v_code := 'WM-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*1000000))::int::text, 6, '0');

    IF p_mode = 'replace' THEN
      UPDATE wellness_memberships SET status = 'expired' WHERE id = p_membership_id;

      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by,
        payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, v_today, (v_today + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'active', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO wellness_memberships(member_id, plan_id, membership_code, start_date, end_date,
        total_servings, used_servings, remaining_servings, status, renewed_from, price_paid, created_by,
        payment_mode, payment_date)
      VALUES (v_old.member_id, v_plan.id, v_code, (GREATEST(v_old.end_date, v_today) + 1)::date,
        (GREATEST(v_old.end_date, v_today) + 1 + v_plan.duration_days)::date,
        v_servings, 0, v_servings, 'queued', p_membership_id, COALESCE(p_price, v_plan.price), auth.uid(),
        COALESCE(p_payment_mode,'cash'), v_pay_date)
      RETURNING id INTO v_new_id;
    END IF;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'renewal_allocation', v_servings, v_servings, auth.uid(),
      COALESCE(p_note, CASE WHEN p_mode = 'queue' THEN 'Queued renewal' ELSE 'Renewal (replaced current plan)' END));
  END IF;

  -- The reward applies only to regular membership renewals, never trial/day plans.
  IF v_is_early AND v_servings > 0 AND v_plan.plan_type = 'membership' THEN
    UPDATE wellness_memberships
       SET total_servings = total_servings + v_bonus,
           remaining_servings = remaining_servings + v_bonus
     WHERE id = v_new_id
     RETURNING remaining_servings INTO v_balance;

    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (v_old.member_id, v_new_id, 'manual_adjustment', v_bonus, v_balance, auth.uid(),
            'Early renewal bonus (+2 servings)');

    INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
    VALUES (v_old.member_id, 'early_renewal_bonus', 'whatsapp');
  END IF;

  UPDATE wellness_members SET status = 'active_member' WHERE id = v_old.member_id;
  INSERT INTO wellness_notification_log(member_id, trigger_key, channel)
  VALUES (v_old.member_id, 'membership_renewed', 'whatsapp');

  IF p_mode = 'queue' THEN
    PERFORM public.activate_next_membership(v_old.member_id);
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_membership_v2(uuid, uuid, integer, numeric, text, text, text, date) TO authenticated, service_role;