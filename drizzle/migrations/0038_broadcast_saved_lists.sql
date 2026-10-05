CREATE TABLE public.whatsapp_broadcast_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_broadcast_lists TO authenticated;
GRANT ALL ON public.whatsapp_broadcast_lists TO service_role;
ALTER TABLE public.whatsapp_broadcast_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage broadcast lists" ON public.whatsapp_broadcast_lists FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid())) WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE TRIGGER trg_whatsapp_broadcast_lists_updated BEFORE UPDATE ON public.whatsapp_broadcast_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_broadcast_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.whatsapp_broadcast_lists(id) ON DELETE CASCADE,
  full_name text,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wblm_list ON public.whatsapp_broadcast_list_members(list_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_broadcast_list_members TO authenticated;
GRANT ALL ON public.whatsapp_broadcast_list_members TO service_role;
ALTER TABLE public.whatsapp_broadcast_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage broadcast list contacts" ON public.whatsapp_broadcast_list_members FOR ALL TO authenticated
  USING (public.is_wellness_manager(auth.uid())) WITH CHECK (public.is_wellness_manager(auth.uid()));