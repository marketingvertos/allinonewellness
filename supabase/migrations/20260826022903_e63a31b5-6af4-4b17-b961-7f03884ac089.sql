REVOKE ALL ON FUNCTION public.expire_stale_checkin_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_checkin_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_checkin_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_checkin_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_checkin_request(uuid, text) TO authenticated;