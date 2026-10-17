CREATE OR REPLACE FUNCTION public.miw_fulfil_payment(p_order_id uuid,p_payment_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record; p uuid;
BEGIN
 IF NOT public.is_payment_service() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO o FROM razorpay_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.context<>'miw' THEN RAISE EXCEPTION 'MIW order not found'; END IF;
 IF o.status='paid' THEN RETURN jsonb_build_object('status','already_paid'); END IF;
 PERFORM 1 FROM wellness_members WHERE id=o.member_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM miw_participants WHERE challenge_id=o.miw_challenge_id AND member_id=o.member_id) THEN RAISE EXCEPTION 'Already registered; contact staff to reconcile payment'; END IF;
 INSERT INTO miw_participants(challenge_id,member_id,source) VALUES(o.miw_challenge_id,o.member_id,'online') RETURNING id INTO p;
 INSERT INTO miw_payments(participant_id,member_id,amount,mode,reference) VALUES(p,o.member_id,o.amount_paise::numeric/100,'online',p_payment_id);
 UPDATE wellness_members SET tags=array_append(array_remove(tags,'miw'),'miw') WHERE id=o.member_id;
 UPDATE razorpay_orders SET status='paid',razorpay_payment_id=p_payment_id,updated_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('status','paid','participant_id',p);
END $$;
REVOKE ALL ON FUNCTION public.miw_fulfil_payment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.miw_fulfil_payment(uuid,text) TO service_role;