-- 0071 gap_audit_fixes
-- Fixes: M2 (grace period off-by-one), C4 (guard_member_self_update tags),
-- M5 (get_supervisor_status auth guard), L2 (miw_report auth tightening)
-- Note: C1, C2, M1 were independently fixed by Lovable in migrations 0068–0070.

-- ===================== M2: refresh_wellness_statuses grace period =====================
-- Fix off-by-one: < v_today - 10 gives 11-day grace, should be <= v_today - 10 for exactly 10 days.
DO $do$
DECLARE fn_body text;
BEGIN
  SELECT prosrc INTO fn_body FROM pg_proc
  WHERE proname = 'refresh_wellness_statuses'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  IF fn_body IS NOT NULL AND fn_body LIKE '%servings_exhausted_on < v_today - 10%' THEN
    fn_body := replace(fn_body, 'servings_exhausted_on < v_today - 10', 'servings_exhausted_on <= v_today - 10');
    EXECUTE format('CREATE OR REPLACE FUNCTION public.refresh_wellness_statuses() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'' AS $f$%s$f$', fn_body);
  END IF;
END $do$;

-- ===================== C4: guard_member_self_update =====================
-- Add tags to the list of blocked columns so members can't self-assign tags.
CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT public.is_wellness_staff(auth.uid()) THEN
    IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.initial_weight IS DISTINCT FROM OLD.initial_weight
      OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.tags IS DISTINCT FROM OLD.tags THEN
      RAISE EXCEPTION 'You can only update your own basic profile details.';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- ===================== M5: get_supervisor_status auth guard =====================
-- Add auth guard so arbitrary member status cannot be read by unauthenticated callers.
CREATE OR REPLACE FUNCTION public.get_supervisor_status(p_member_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month text; v_sup boolean; v_self boolean; v_new_fl integer;
  v_fl integer; v_tot integer; v_level integer;
BEGIN
  IF NOT (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), p_member_id)) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  v_month := public.ist_month();
  SELECT 'supervisor' = ANY(tags), frontline_count, network_total, master_level
    INTO v_sup, v_fl, v_tot, v_level
  FROM public.wellness_members WHERE id = p_member_id;

  v_self := public.member_active_in_month(p_member_id, v_month);
  v_new_fl := public.supervisor_new_frontline(p_member_id, v_month);

  RETURN jsonb_build_object(
    'month', v_month,
    'is_supervisor', COALESCE(v_sup, false),
    'self_renewed', COALESCE(v_self, false),
    'new_frontline_count', COALESCE(v_new_fl, 0),
    'new_frontline_required', 2,
    'qualifying_frontline', COALESCE(v_fl, 0),
    'qualifying_network_total', COALESCE(v_tot, 0),
    'master_level', COALESCE(v_level, 0),
    'is_qualified', COALESCE(v_sup, false) AND COALESCE(v_self, false) AND COALESCE(v_new_fl, 0) >= 2
  );
END;
$function$;

-- ===================== L2: miw_report auth tightening =====================
-- Require staff auth — regular members should not call this RPC directly;
-- they access their own data through the participant-level filter.
CREATE OR REPLACE FUNCTION public.miw_report(p_challenge_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; rows jsonb;
BEGIN
 SELECT * INTO c FROM miw_challenges WHERE id=p_challenge_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
 IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
 FROM miw_participants p JOIN wellness_members m ON m.id=p.member_id WHERE challenge_id=c.id
 ) SELECT COALESCE(jsonb_agg(to_jsonb(people) ORDER BY latest_weight-start_weight NULLS LAST),'[]') INTO rows FROM people;
 RETURN jsonb_build_object('challenge',to_jsonb(c),'participants',rows,'participant_count',jsonb_array_length(rows),
 'total_paid',(SELECT COALESCE(sum(pay.amount),0) FROM miw_payments pay JOIN miw_participants p ON p.id=pay.participant_id WHERE p.challenge_id=c.id));
END $$;
