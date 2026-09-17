CREATE OR REPLACE FUNCTION public.admin_update_membership(
  p_membership_id uuid,
  p_plan_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_total_servings integer DEFAULT NULL,
  p_remaining_servings integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_payment_mode text DEFAULT NULL,
  p_payment_date date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_m record; v_total int; v_remaining int; v_delta int;
BEGIN
  IF NOT public.is_wellness_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  SELECT * INTO v_m FROM wellness_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.'; END IF;

  v_total := GREATEST(COALESCE(p_total_servings, v_m.total_servings), 0);
  v_remaining := COALESCE(p_remaining_servings, v_m.remaining_servings);
  IF v_remaining < 0 THEN v_remaining := 0; END IF;
  IF v_remaining > v_total THEN v_remaining := v_total; END IF;

  UPDATE wellness_memberships SET
    plan_id = COALESCE(p_plan_id, plan_id),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    total_servings = v_total,
    remaining_servings = v_remaining,
    used_servings = GREATEST(v_total - v_remaining, 0),
    price_paid = COALESCE(p_price, price_paid),
    payment_mode = COALESCE(p_payment_mode, payment_mode),
    payment_date = COALESCE(p_payment_date, payment_date),
    updated_at = now()
  WHERE id = p_membership_id;

  v_delta := v_remaining - v_m.remaining_servings;
  IF v_delta <> 0 THEN
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, note, created_by)
    VALUES (v_m.member_id, p_membership_id, 'manual_adjustment', v_delta, v_remaining,
            'Membership corrected by admin', auth.uid());
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_membership(uuid, uuid, date, date, integer, integer, numeric, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_pink_card_referrer_set()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF NEW.referred_by_member_id IS NULL
     OR NEW.referred_by_member_id IS NOT DISTINCT FROM OLD.referred_by_member_id THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT ms.id FROM wellness_memberships ms
    JOIN wellness_plans p ON p.id = ms.plan_id
    WHERE ms.member_id = NEW.id AND COALESCE(p.duration_days, 0) >= 28
    ORDER BY ms.created_at LIMIT 1
  LOOP
    PERFORM public.award_pink_card(NEW.id, 3, 'membership_referral', r.id);
  END LOOP;

  FOR r IN
    SELECT t.id FROM wellness_trials t WHERE t.member_id = NEW.id ORDER BY t.created_at LIMIT 1
  LOOP
    PERFORM public.award_pink_card(NEW.id, 1, 'trial_referral', r.id);
  END LOOP;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pink_card_on_referrer_set ON public.wellness_members;
CREATE TRIGGER pink_card_on_referrer_set
AFTER UPDATE OF referred_by_member_id ON public.wellness_members
FOR EACH ROW EXECUTE FUNCTION public.trg_pink_card_referrer_set();

DROP TRIGGER IF EXISTS pink_card_on_membership_plan_change ON public.wellness_memberships;
CREATE TRIGGER pink_card_on_membership_plan_change
AFTER UPDATE OF plan_id ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_pink_card_membership();