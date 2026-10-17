CREATE TABLE IF NOT EXISTS public.miw_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL DEFAULT 'MIW 21-Day Challenge',
 start_date date NOT NULL, end_date date NOT NULL, fee numeric(10,2) NOT NULL DEFAULT 500,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','completed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date >= start_date), CHECK(fee > 0)
);
GRANT SELECT ON public.miw_challenges TO authenticated;
GRANT ALL ON public.miw_challenges TO service_role;
ALTER TABLE public.miw_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY miw_challenges_read ON public.miw_challenges FOR SELECT TO authenticated USING(true);
GRANT INSERT,UPDATE ON public.miw_challenges TO authenticated;
CREATE POLICY miw_challenges_manage ON public.miw_challenges FOR ALL TO authenticated USING(public.is_wellness_manager(auth.uid())) WITH CHECK(public.is_wellness_manager(auth.uid()));
CREATE UNIQUE INDEX miw_one_open ON public.miw_challenges(status) WHERE status='open';
CREATE TABLE public.miw_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenge_id uuid NOT NULL REFERENCES public.miw_challenges(id),
 member_id uuid NOT NULL REFERENCES public.wellness_members(id), source text NOT NULL DEFAULT 'staff', joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(challenge_id,member_id)
);
GRANT SELECT ON public.miw_participants TO authenticated;
GRANT ALL ON public.miw_participants TO service_role;
ALTER TABLE public.miw_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY miw_participants_read ON public.miw_participants FOR SELECT TO authenticated USING(public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(member_id));
CREATE TABLE public.miw_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), participant_id uuid NOT NULL REFERENCES public.miw_participants(id),
 member_id uuid NOT NULL REFERENCES public.wellness_members(id), amount numeric(10,2) NOT NULL CHECK(amount>0), mode public.payment_mode NOT NULL,
 reference text, paid_at timestamptz NOT NULL DEFAULT now(), recorded_by uuid
);
GRANT SELECT ON public.miw_payments TO authenticated;
GRANT ALL ON public.miw_payments TO service_role;
ALTER TABLE public.miw_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY miw_payments_read ON public.miw_payments FOR SELECT TO authenticated USING(public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(member_id));
ALTER TABLE public.razorpay_orders ADD COLUMN IF NOT EXISTS miw_challenge_id uuid REFERENCES public.miw_challenges(id);
CREATE UNIQUE INDEX miw_pending_order ON public.razorpay_orders(member_id,miw_challenge_id) WHERE context='miw' AND status='created';
CREATE OR REPLACE FUNCTION public.miw_register_member(p_challenge_id uuid,p_member_id uuid,p_payments jsonb DEFAULT '[{"amount":500,"mode":"cash"}]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; p uuid; line jsonb; total numeric:=0;
BEGIN
 IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO c FROM miw_challenges WHERE id=p_challenge_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'open' OR c.end_date<(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Registration is closed'; END IF;
 PERFORM 1 FROM wellness_members WHERE id=p_member_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM miw_participants WHERE challenge_id=c.id AND member_id=p_member_id) THEN RAISE EXCEPTION 'Already registered'; END IF;
 IF EXISTS(SELECT 1 FROM razorpay_orders WHERE member_id=p_member_id AND miw_challenge_id=c.id AND status='created') THEN RAISE EXCEPTION 'An online payment is pending; finish it before staff registration'; END IF;
 IF jsonb_typeof(p_payments)<>'array' OR jsonb_array_length(p_payments) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Enter one to four payment lines'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
 IF (line->>'amount')::numeric<=0 OR (line->>'mode') NOT IN ('cash','upi','online','card') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 total:=total+(line->>'amount')::numeric;
 END LOOP;
 IF total<=0 THEN RAISE EXCEPTION 'Enter amount paid'; END IF;
 INSERT INTO miw_participants(challenge_id,member_id) VALUES(c.id,p_member_id) RETURNING id INTO p;
 FOR line IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
 INSERT INTO miw_payments(participant_id,member_id,amount,mode,reference,recorded_by) VALUES(p,p_member_id,(line->>'amount')::numeric,(line->>'mode')::payment_mode,line->>'reference',auth.uid()); END LOOP;
 UPDATE wellness_members SET tags=array_append(array_remove(tags,'miw'),'miw') WHERE id=p_member_id;
 RETURN jsonb_build_object('status','ok','participant_id',p,'amount_paid',total);
END $$;
CREATE OR REPLACE FUNCTION public.miw_report(p_challenge_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; rows jsonb;
BEGIN
 SELECT * INTO c FROM miw_challenges WHERE id=p_challenge_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
 WITH readings AS (
 SELECT member_id,recorded_date,weight,created_at FROM weight_tracking
 UNION ALL SELECT member_id,recorded_date,weight,created_at FROM body_measurements WHERE weight IS NOT NULL
 ), people AS (
 SELECT p.id participant_id,p.member_id,m.full_name member_name,m.mobile_number mobile,p.source,p.joined_at,
 (SELECT weight FROM readings w WHERE w.member_id=p.member_id AND recorded_date<=c.start_date ORDER BY recorded_date DESC,created_at DESC LIMIT 1) start_weight,
 (SELECT weight FROM readings w WHERE w.member_id=p.member_id AND recorded_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date) ORDER BY recorded_date DESC,created_at DESC LIMIT 1) latest_weight,
 (SELECT count(*) FROM wellness_attendance a WHERE a.member_id=p.member_id AND a.checkin_method<>'serving_issue' AND visit_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) visits,
 (SELECT count(DISTINCT visit_date) FROM wellness_attendance a WHERE a.member_id=p.member_id AND a.checkin_method<>'serving_issue' AND visit_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) days_attended,
 (SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY recorded_date,created_at),'[]') FROM readings w WHERE w.member_id=p.member_id AND recorded_date BETWEEN c.start_date AND LEAST(c.end_date,(now() AT TIME ZONE 'Asia/Kolkata')::date)) journey
 FROM miw_participants p JOIN wellness_members m ON m.id=p.member_id WHERE challenge_id=c.id AND (public.is_wellness_staff(auth.uid()) OR m.user_id=auth.uid())
 ) SELECT COALESCE(jsonb_agg(to_jsonb(people) ORDER BY latest_weight-start_weight NULLS LAST),'[]') INTO rows FROM people;
 RETURN jsonb_build_object('challenge',to_jsonb(c),'participants',rows,'participant_count',jsonb_array_length(rows),
 'total_paid',(SELECT COALESCE(sum(pay.amount),0) FROM miw_payments pay JOIN miw_participants p ON p.id=pay.participant_id WHERE p.challenge_id=c.id AND (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(p.member_id))));
END $$;
REVOKE ALL ON FUNCTION public.miw_register_member(uuid,uuid,jsonb),public.miw_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.miw_register_member(uuid,uuid,jsonb),public.miw_report(uuid) TO authenticated,service_role;
