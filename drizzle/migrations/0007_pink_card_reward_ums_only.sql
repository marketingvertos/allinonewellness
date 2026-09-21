CREATE OR REPLACE FUNCTION public.trg_pink_card_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_plan_type text;
BEGIN
  -- Only award on FIRST membership (renewals and plan switches never qualify)
  IF NEW.renewed_from IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only the UMS 30 plan (₹7,500 membership) earns the +3 referral reward
  SELECT price, plan_type INTO v_price, v_plan_type FROM wellness_plans WHERE id = NEW.plan_id;
  IF v_plan_type = 'membership' AND v_price = 7500 THEN
    PERFORM public.award_pink_card(NEW.member_id, 3, 'membership_referral', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;