REVOKE ALL ON FUNCTION public.activate_next_membership(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_next_membership(uuid) TO service_role;