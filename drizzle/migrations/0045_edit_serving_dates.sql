ALTER TABLE public.wellness_attendance ADD COLUMN IF NOT EXISTS serving_txn_id uuid REFERENCES public.serving_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_serving_txn ON public.wellness_attendance(serving_txn_id);

UPDATE public.wellness_attendance a SET serving_txn_id = t.id
FROM public.serving_transactions t
WHERE t.attendance_id = a.id AND a.serving_txn_id IS NULL;

UPDATE public.wellness_attendance a SET serving_txn_id = t.id
FROM public.serving_transactions t
WHERE a.serving_txn_id IS NULL AND a.checkin_method = 'serving_issue'
  AND t.txn_type = 'pack_and_issue' AND t.member_id = a.member_id
  AND abs(extract(epoch FROM (t.created_at - a.created_at))) < 5;

CREATE OR REPLACE FUNCTION public.issue_servings(p_membership_id uuid, p_quantity integer, p_reason text DEFAULT 'Packed for member'::text, p_dates date[] DEFAULT NULL::date[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_membership record; v_new_balance integer; v_date date; v_note text; v_txn uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised to issue servings'; END IF;
  SELECT * INTO v_membership FROM public.wellness_memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;
  IF v_membership.remaining_servings < p_quantity THEN
    RAISE EXCEPTION 'Not enough servings remaining. Available: %, Requested: %', v_membership.remaining_servings, p_quantity;
  END IF;
  IF p_dates IS NOT NULL AND cardinality(p_dates) > 0 THEN
    IF cardinality(p_dates) <> p_quantity THEN RAISE EXCEPTION 'Pick one date per serving'; END IF;
    IF (SELECT count(DISTINCT d) FROM unnest(p_dates) d) <> cardinality(p_dates) THEN RAISE EXCEPTION 'Dates must be different'; END IF;
  END IF;
  v_new_balance := v_membership.remaining_servings - p_quantity;
  UPDATE public.wellness_memberships SET remaining_servings = v_new_balance, used_servings = used_servings + p_quantity, updated_at = now()
  WHERE id = p_membership_id;
  v_note := COALESCE(NULLIF(TRIM(p_reason), ''), 'Packed for member');
  INSERT INTO public.serving_transactions (membership_id, member_id, change, balance_after, txn_type, note, created_by)
  VALUES (p_membership_id, v_membership.member_id, -p_quantity, v_new_balance, 'pack_and_issue', v_note, auth.uid())
  RETURNING id INTO v_txn;
  IF p_dates IS NOT NULL THEN
    FOREACH v_date IN ARRAY p_dates LOOP
      INSERT INTO public.wellness_attendance (member_id, membership_id, visit_date, visit_time, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id, serving_txn_id)
      VALUES (v_membership.member_id, p_membership_id, v_date, (v_date::text || ' 09:00:00+05:30')::timestamptz, 'serving_issue', true, v_new_balance, auth.uid(), v_txn)
      ON CONFLICT (member_id, visit_date) DO NOTHING;
    END LOOP;
  END IF;
  RETURN v_new_balance;
END; $function$;

CREATE OR REPLACE FUNCTION public.edit_serving_dates(p_txn_id uuid, p_dates date[])
 RETURNS date[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_txn record; v_old date[]; v_date date; v_conflict date; v_name text;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised to edit servings'; END IF;
  SELECT * INTO v_txn FROM public.serving_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND OR v_txn.txn_type <> 'pack_and_issue' THEN RAISE EXCEPTION 'Packed serving entry not found'; END IF;
  p_dates := COALESCE(p_dates, ARRAY[]::date[]);
  IF cardinality(p_dates) > abs(v_txn.change) THEN RAISE EXCEPTION 'Pick at most % dates', abs(v_txn.change); END IF;
  IF (SELECT count(DISTINCT d) FROM unnest(p_dates) d) <> cardinality(p_dates) THEN RAISE EXCEPTION 'Dates must be different'; END IF;

  SELECT min(d) INTO v_conflict FROM unnest(p_dates) d
  WHERE EXISTS (SELECT 1 FROM public.wellness_attendance a WHERE a.member_id = v_txn.member_id AND a.visit_date = d
    AND (a.serving_txn_id IS DISTINCT FROM p_txn_id));
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Member already has attendance on %', to_char(v_conflict, 'DD Mon YYYY');
  END IF;

  SELECT COALESCE(array_agg(visit_date ORDER BY visit_date), ARRAY[]::date[]) INTO v_old
  FROM public.wellness_attendance WHERE serving_txn_id = p_txn_id;

  UPDATE public.serving_transactions SET attendance_id = NULL WHERE id = p_txn_id;
  DELETE FROM public.wellness_attendance WHERE serving_txn_id = p_txn_id AND checkin_method = 'serving_issue';

  FOREACH v_date IN ARRAY p_dates LOOP
    INSERT INTO public.wellness_attendance (member_id, membership_id, visit_date, visit_time, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id, serving_txn_id)
    VALUES (v_txn.member_id, v_txn.membership_id, v_date, (v_date::text || ' 09:00:00+05:30')::timestamptz, 'serving_issue', true, v_txn.balance_after, auth.uid(), p_txn_id);
  END LOOP;

  SELECT full_name INTO v_name FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.member_notes (member_id, note, created_by)
  VALUES (v_txn.member_id,
    'Serving dates changed from ' ||
      COALESCE(NULLIF((SELECT string_agg(to_char(d,'DD Mon'), ', ') FROM unnest(v_old) d), ''), 'none') ||
      ' to ' || COALESCE(NULLIF((SELECT string_agg(to_char(d,'DD Mon'), ', ' ORDER BY d) FROM unnest(p_dates) d), ''), 'none') ||
      COALESCE(' by ' || v_name, ''),
    auth.uid());

  RETURN (SELECT COALESCE(array_agg(d ORDER BY d), ARRAY[]::date[]) FROM unnest(p_dates) d);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.edit_serving_dates(uuid, date[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.edit_serving_dates(uuid, date[]) TO authenticated;