REVOKE ALL ON FUNCTION public.award_pink_card(uuid, integer, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_pink_card_trial() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_pink_card_membership() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_pink_card(uuid, integer, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.adjust_pink_card(uuid, integer, text) FROM anon;