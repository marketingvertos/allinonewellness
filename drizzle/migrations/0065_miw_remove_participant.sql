ALTER TABLE public.miw_participants ADD COLUMN IF NOT EXISTS removed_at timestamptz, ADD COLUMN IF NOT EXISTS removed_by uuid, ADD COLUMN IF NOT EXISTS removed_reason text;
ALTER TABLE public.miw_payments ADD COLUMN IF NOT EXISTS voided_at timestamptz, ADD COLUMN IF NOT EXISTS void_reason text;

CREATE OR REPLACE FUNCTION public.miw_remove_participant(p_participant_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_member uuid;
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can remove MIW participants'; END IF;
  UPDATE miw_participants SET removed_at=now(), removed_by=auth.uid(), removed_reason=NULLIF(trim(p_reason),'')
   WHERE id=p_participant_id AND removed_at IS NULL RETURNING member_id INTO v_member;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Participant not found or already removed'; END IF;
  UPDATE miw_payments SET voided_at=now(), void_reason=COALESCE(NULLIF(trim(p_reason),''),'Removed from challenge')
   WHERE participant_id=p_participant_id AND voided_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM miw_participants WHERE member_id=v_member AND removed_at IS NULL) THEN
    UPDATE wellness_members SET tags=array_remove(tags,'miw') WHERE id=v_member;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.miw_remove_participant(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.miw_remove_participant(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.miw_report(p_challenge_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
 FROM miw_participants p JOIN wellness_members m ON m.id=p.member_id WHERE challenge_id=c.id AND p.removed_at IS NULL AND (public.is_wellness_staff(auth.uid()) OR m.user_id=auth.uid())
 ) SELECT COALESCE(jsonb_agg(to_jsonb(people) ORDER BY latest_weight-start_weight NULLS LAST),'[]') INTO rows FROM people;
 RETURN jsonb_build_object('challenge',to_jsonb(c),'participants',rows,'participant_count',jsonb_array_length(rows),
 'total_paid',(SELECT COALESCE(sum(pay.amount),0) FROM miw_payments pay JOIN miw_participants p ON p.id=pay.participant_id WHERE p.challenge_id=c.id AND p.removed_at IS NULL AND pay.voided_at IS NULL AND (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(),p.member_id))));
END $function$;