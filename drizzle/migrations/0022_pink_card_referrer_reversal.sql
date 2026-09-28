CREATE OR REPLACE FUNCTION public.award_pink_card(p_referred_member_id uuid, p_change integer, p_reason text, p_reference_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_balance integer; v_net integer;
BEGIN
  SELECT referred_by_member_id INTO v_referrer FROM wellness_members WHERE id = p_referred_member_id;
  IF v_referrer IS NULL OR v_referrer = p_referred_member_id THEN RETURN; END IF;

  SELECT COALESCE(SUM(change),0) INTO v_net FROM pink_card_ledger
   WHERE referred_member_id = p_referred_member_id AND member_id = v_referrer
     AND (reason = p_reason OR (reason = 'referral_reversal' AND note = p_reason));
  IF v_net > 0 THEN RETURN; END IF;

  UPDATE wellness_members SET pink_card_balance = pink_card_balance + p_change
   WHERE id = v_referrer RETURNING pink_card_balance INTO v_balance;

  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, reference_id, referred_member_id)
  VALUES (v_referrer, p_change, v_balance, p_reason, p_reference_id, p_referred_member_id);
END; $$;

CREATE OR REPLACE FUNCTION public.trg_pink_card_referrer_set()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_reason text; v_net integer; v_balance integer;
BEGIN
  IF NEW.referred_by_member_id IS NOT DISTINCT FROM OLD.referred_by_member_id THEN
    RETURN NEW;
  END IF;

  IF OLD.referred_by_member_id IS NOT NULL THEN
    FOREACH v_reason IN ARRAY ARRAY['trial_referral','membership_referral'] LOOP
      SELECT COALESCE(SUM(change),0) INTO v_net FROM pink_card_ledger
       WHERE referred_member_id = NEW.id AND member_id = OLD.referred_by_member_id
         AND (reason = v_reason OR (reason = 'referral_reversal' AND note = v_reason));
      IF v_net > 0 THEN
        UPDATE wellness_members SET pink_card_balance = pink_card_balance - v_net
         WHERE id = OLD.referred_by_member_id RETURNING pink_card_balance INTO v_balance;
        INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, referred_member_id, note, created_by)
        VALUES (OLD.referred_by_member_id, -v_net, v_balance, 'referral_reversal', NEW.id, v_reason, auth.uid());
      END IF;
    END LOOP;
  END IF;

  IF NEW.referred_by_member_id IS NOT NULL THEN
    FOR r IN
      SELECT ms.id FROM wellness_memberships ms JOIN wellness_plans p ON p.id = ms.plan_id
       WHERE ms.member_id = NEW.id AND ms.renewed_from IS NULL
         AND p.plan_type = 'membership' AND p.price = 7500
       ORDER BY ms.created_at LIMIT 1
    LOOP
      PERFORM public.award_pink_card(NEW.id, 3, 'membership_referral', r.id);
    END LOOP;
    FOR r IN SELECT t.id FROM wellness_trials t WHERE t.member_id = NEW.id ORDER BY t.created_at LIMIT 1 LOOP
      PERFORM public.award_pink_card(NEW.id, 1, 'trial_referral', r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;