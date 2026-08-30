DROP FUNCTION IF EXISTS public.member_self_checkin(text);
DROP FUNCTION IF EXISTS public.approve_checkin_request(uuid);

REVOKE ALL ON FUNCTION public.member_self_checkin(text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_checkin_request(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_self_checkin(text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_checkin_request(uuid, numeric) TO authenticated, service_role;