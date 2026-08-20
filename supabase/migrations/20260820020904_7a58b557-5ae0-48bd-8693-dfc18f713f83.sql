CREATE POLICY "Members log own weight" ON public.weight_tracking FOR INSERT TO authenticated
WITH CHECK (auth.uid() = recorded_by AND public.owns_wellness_member(auth.uid(), member_id));

CREATE OR REPLACE FUNCTION public.guard_member_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT public.is_wellness_staff(auth.uid()) THEN
    IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.initial_weight IS DISTINCT FROM OLD.initial_weight
      OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'You can only update your own basic profile details.';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;