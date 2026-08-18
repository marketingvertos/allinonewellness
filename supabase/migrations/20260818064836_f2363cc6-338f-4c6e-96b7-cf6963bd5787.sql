
REVOKE EXECUTE ON FUNCTION public.checkin_member(uuid, public.checkin_method) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.convert_trial_to_membership(uuid, uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_membership(uuid, uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.renew_membership(uuid, uuid, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.adjust_servings(uuid, integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refresh_wellness_statuses() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_wellness_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_wellness_manager(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.owns_wellness_member(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.checkin_member(uuid, public.checkin_method) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_trial_to_membership(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_membership(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_membership(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_servings(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_wellness_statuses() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_wellness_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_wellness_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_wellness_member(uuid, uuid) TO authenticated, service_role;
