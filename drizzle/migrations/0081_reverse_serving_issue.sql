ALTER TABLE public.serving_transactions ADD COLUMN IF NOT EXISTS reversed_at timestamptz, ADD COLUMN IF NOT EXISTS reversed_by uuid, ADD COLUMN IF NOT EXISTS reversal_note text, ADD COLUMN IF NOT EXISTS reverses_txn_id uuid;

CREATE OR REPLACE FUNCTION public.reverse_serving_issue(p_txn_id uuid, p_note text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_txn record; v_qty integer; v_bal integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can reverse servings'; END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN RAISE EXCEPTION 'Please add a note'; END IF;
  SELECT * INTO v_txn FROM public.serving_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF v_txn.txn_type <> 'pack_and_issue' THEN RAISE EXCEPTION 'Only packed servings can be reversed'; END IF;
  IF v_txn.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'Already reversed'; END IF;
  v_qty := abs(v_txn.change);
  UPDATE public.wellness_memberships SET remaining_servings = remaining_servings + v_qty,
    used_servings = greatest(0, used_servings - v_qty), updated_at = now()
  WHERE id = v_txn.membership_id RETURNING remaining_servings INTO v_bal;
  DELETE FROM public.wellness_attendance WHERE serving_txn_id = p_txn_id;
  UPDATE public.serving_transactions SET reversed_at = now(), reversed_by = auth.uid(), reversal_note = trim(p_note) WHERE id = p_txn_id;
  INSERT INTO public.serving_transactions (membership_id, member_id, change, balance_after, txn_type, note, created_by, reverses_txn_id)
  VALUES (v_txn.membership_id, v_txn.member_id, v_qty, v_bal, 'manual_adjustment', 'Reversed packed serving: ' || trim(p_note), auth.uid(), p_txn_id);
  RETURN v_bal;
END; $$;
REVOKE ALL ON FUNCTION public.reverse_serving_issue(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reverse_serving_issue(uuid, text) TO authenticated;