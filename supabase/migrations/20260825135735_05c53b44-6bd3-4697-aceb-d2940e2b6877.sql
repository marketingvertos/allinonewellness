REVOKE ALL ON FUNCTION public.recalc_member_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_member_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_weight_achievements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_member_referral() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_all_member_achievements() FROM PUBLIC, anon;