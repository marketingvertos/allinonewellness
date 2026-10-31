CREATE OR REPLACE FUNCTION public.staff_credit_checkin(p_member_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_m record; v_att uuid; v_new int;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can mark credit visits.'; END IF;
  IF EXISTS (SELECT 1 FROM wellness_attendance WHERE member_id = p_member_id AND visit_date = v_today) THEN
    RETURN jsonb_build_object('status','duplicate','message','Already checked in today.');
  END IF;
  SELECT * INTO v_m FROM wellness_memberships
   WHERE member_id = p_member_id AND status NOT IN ('cancelled','queued')
   ORDER BY start_date DESC, created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','no_plan','message','This member has no plan to credit against.'); END IF;
  IF v_m.remaining_servings > 0 THEN RETURN jsonb_build_object('status','has_servings','message','Member still has servings — use normal check-in.'); END IF;
  IF v_m.remaining_servings <= -3 THEN RETURN jsonb_build_object('status','limit','message','Credit limit reached (3). Please renew first.'); END IF;
  v_new := v_m.remaining_servings - 1;
  INSERT INTO wellness_attendance(member_id, membership_id, checkin_method, serving_deducted, remaining_balance_snapshot, staff_id)
  VALUES (p_member_id, v_m.id, 'admin_manual', true, v_new, auth.uid()) RETURNING id INTO v_att;
  UPDATE wellness_memberships SET used_servings = used_servings + 1, remaining_servings = v_new WHERE id = v_m.id;
  INSERT INTO serving_transactions(member_id, membership_id, attendance_id, txn_type, change, balance_after, created_by, note)
  VALUES (p_member_id, v_m.id, v_att, 'daily_deduction', -1, v_new, auth.uid(),
          'Credit visit ' || (-v_new) || ' of 3 — deducted on renewal' || COALESCE(' · ' || NULLIF(trim(p_note),''), ''));
  RETURN jsonb_build_object('status','ok','mode','credit','remaining', v_new, 'owed', -v_new);
END $$;
GRANT EXECUTE ON FUNCTION public.staff_credit_checkin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_credit_servings_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owed int := 0; r record; v_bal int;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  IF NEW.status NOT IN ('active','expiring_soon') OR NEW.remaining_servings <= 0 THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NULL; END IF;
  FOR r IN SELECT id, remaining_servings FROM wellness_memberships
            WHERE member_id = NEW.member_id AND id <> NEW.id AND remaining_servings < 0 FOR UPDATE LOOP
    v_owed := v_owed - r.remaining_servings;
    UPDATE wellness_memberships SET remaining_servings = 0 WHERE id = r.id;
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (NEW.member_id, r.id, 'manual_adjustment', -r.remaining_servings, 0, COALESCE(auth.uid(), NEW.created_by), 'Credit visits moved to new plan');
  END LOOP;
  IF v_owed > 0 THEN
    UPDATE wellness_memberships SET remaining_servings = remaining_servings - v_owed, used_servings = used_servings + v_owed
     WHERE id = NEW.id RETURNING remaining_servings INTO v_bal;
    INSERT INTO serving_transactions(member_id, membership_id, txn_type, change, balance_after, created_by, note)
    VALUES (NEW.member_id, NEW.id, 'manual_adjustment', -v_owed, v_bal, COALESCE(auth.uid(), NEW.created_by), 'Credit visits settled (-' || v_owed || ')');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_settle_credit_servings ON public.wellness_memberships;
CREATE TRIGGER trg_settle_credit_servings AFTER INSERT OR UPDATE OF status ON public.wellness_memberships
FOR EACH ROW EXECUTE FUNCTION public.settle_credit_servings_trg();