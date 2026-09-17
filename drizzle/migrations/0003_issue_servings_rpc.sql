CREATE OR REPLACE FUNCTION public.issue_servings(
  p_membership_id uuid,
  p_quantity integer,
  p_reason text DEFAULT 'Packed for member'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership record;
  v_new_balance integer;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to issue servings';
  END IF;

  SELECT * INTO v_membership FROM public.wellness_memberships
  WHERE id = p_membership_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  IF v_membership.remaining_servings < p_quantity THEN
    RAISE EXCEPTION 'Not enough servings remaining. Available: %, Requested: %',
      v_membership.remaining_servings, p_quantity;
  END IF;

  v_new_balance := v_membership.remaining_servings - p_quantity;

  UPDATE public.wellness_memberships
  SET remaining_servings = v_new_balance,
      used_servings = used_servings + p_quantity,
      updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.serving_transactions (
    membership_id, member_id, change, balance_after, txn_type, note, created_by
  ) VALUES (
    p_membership_id,
    v_membership.member_id,
    -p_quantity,
    v_new_balance,
    'pack_and_issue',
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Packed for member'),
    auth.uid()
  );

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_servings(uuid, integer, text) TO authenticated;