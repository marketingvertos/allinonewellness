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