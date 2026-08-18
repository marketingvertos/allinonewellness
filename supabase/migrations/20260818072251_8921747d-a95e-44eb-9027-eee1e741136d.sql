CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_digits text;
BEGIN
  IF (NEW.raw_user_meta_data->>'account_type') = 'wellness_member' THEN
    v_digits := right(regexp_replace(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'mobile_number', ''), '\D', '', 'g'), 10);
    IF length(v_digits) = 10 THEN
      UPDATE public.wellness_members
      SET user_id = NEW.id
      WHERE user_id IS NULL
        AND right(regexp_replace(mobile_number, '\D', '', 'g'), 10) = v_digits;
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rep');
  RETURN NEW;
END;
$function$;