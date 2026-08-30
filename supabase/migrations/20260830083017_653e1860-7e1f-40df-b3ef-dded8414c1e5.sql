-- 1. Member categories
CREATE TABLE public.member_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('loss','gain')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.member_categories TO authenticated;
GRANT ALL ON public.member_categories TO service_role;

ALTER TABLE public.member_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read categories"
  ON public.member_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert categories"
  ON public.member_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE POLICY "Managers can update categories"
  ON public.member_categories FOR UPDATE TO authenticated
  USING (public.is_wellness_manager(auth.uid()))
  WITH CHECK (public.is_wellness_manager(auth.uid()));
CREATE POLICY "Managers can delete categories"
  ON public.member_categories FOR DELETE TO authenticated
  USING (public.is_wellness_manager(auth.uid()));

CREATE TRIGGER update_member_categories_updated_at
  BEFORE UPDATE ON public.member_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.member_categories (name, slug, direction, sort_order) VALUES
  ('Weight loss', 'weight_loss', 'loss', 1),
  ('Weight gain', 'weight_gain', 'gain', 2);

ALTER TABLE public.wellness_members
  ADD COLUMN category_id uuid REFERENCES public.member_categories(id) ON DELETE SET NULL;

UPDATE public.wellness_members m
SET category_id = c.id
FROM public.member_categories c
WHERE c.slug = CASE WHEN m.goal = 'weight_gain' THEN 'weight_gain' ELSE 'weight_loss' END
  AND m.category_id IS NULL;

CREATE INDEX idx_wellness_members_category ON public.wellness_members(category_id);

-- 2. Queued memberships
ALTER TYPE membership_status ADD VALUE IF NOT EXISTS 'queued';
