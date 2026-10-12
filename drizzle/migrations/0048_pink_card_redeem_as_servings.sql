-- Allow Pink Card credits to be redeemed as extra servings on the member's
-- active membership, instead of only as a monetary discount on renewal.

CREATE OR REPLACE FUNCTION public.redeem_pink_card_as_servings(
  p_member_id uuid,
  p_credits integer,
  p_note text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_balance integer;
  v_membership_id uuid;
  v_remaining integer;
  v_new_remaining integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  IF COALESCE(p_credits, 0) <= 0 THEN
    RAISE EXCEPTION 'Credits must be positive.';
  END IF;

  -- Lock the member row and check balance
  SELECT pink_card_balance INTO v_balance
  FROM wellness_members WHERE id = p_member_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Member not found.'; END IF;
  IF p_credits > v_balance THEN RAISE EXCEPTION 'Not enough Pink Card credit.'; END IF;

  -- Find the active membership
  SELECT id, remaining_servings INTO v_membership_id, v_remaining
  FROM wellness_memberships
  WHERE member_id = p_member_id AND status IN ('active', 'expiring_soon')
  ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'expiring_soon' THEN 1 END
  LIMIT 1
  FOR UPDATE;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'No active membership found. The member needs an active plan to receive extra servings.';
  END IF;

  -- Deduct Pink Card balance
  v_balance := v_balance - p_credits;
  UPDATE wellness_members SET pink_card_balance = v_balance WHERE id = p_member_id;

  -- Record Pink Card ledger entry
  INSERT INTO pink_card_ledger(member_id, change, balance_after, reason, reference_id, note, created_by)
  VALUES (p_member_id, -p_credits, v_balance, 'serving_redemption', v_membership_id,
    COALESCE(p_note, 'Redeemed as ' || p_credits || ' extra serving' || CASE WHEN p_credits > 1 THEN 's' ELSE '' END),
    auth.uid());

  -- Add servings to the membership
  v_new_remaining := v_remaining + p_credits;
  UPDATE wellness_memberships
  SET remaining_servings = v_new_remaining,
      total_servings = total_servings + p_credits,
      updated_at = now()
  WHERE id = v_membership_id;

  -- Record serving transaction
  INSERT INTO serving_transactions(member_id, membership_id, txn_type, quantity, balance_after, created_by, note)
  VALUES (p_member_id, v_membership_id, 'manual_adjustment', p_credits, v_new_remaining, auth.uid(),
    'Pink Card redemption (+' || p_credits || ' serving' || CASE WHEN p_credits > 1 THEN 's' ELSE '' END || ')');

  RETURN json_build_object('new_balance', v_balance, 'new_servings', v_new_remaining);
END; $$;

REVOKE ALL ON FUNCTION public.redeem_pink_card_as_servings(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_pink_card_as_servings(uuid, integer, text) TO authenticated;
