ALTER TABLE public.wellness_members
  ADD COLUMN IF NOT EXISTS member_mode text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.wellness_members
  ADD CONSTRAINT wellness_members_member_mode_check
  CHECK (member_mode IN ('physical','virtual'));

CREATE INDEX IF NOT EXISTS idx_wellness_members_member_mode ON public.wellness_members (member_mode);
CREATE INDEX IF NOT EXISTS idx_wellness_members_tags ON public.wellness_members USING GIN (tags);