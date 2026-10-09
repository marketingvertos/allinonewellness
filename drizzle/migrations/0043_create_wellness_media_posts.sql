CREATE TABLE public.wellness_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL,
  image_path text,
  youtube_video_id text,
  caption text,
  visibility text NOT NULL DEFAULT 'all',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wellness_media_posts_media_type_check CHECK (media_type IN ('image', 'youtube')),
  CONSTRAINT wellness_media_posts_visibility_check CHECK (visibility IN ('all', 'physical', 'virtual')),
  CONSTRAINT wellness_media_posts_source_check CHECK (
    (media_type = 'image' AND image_path IS NOT NULL AND youtube_video_id IS NULL)
    OR (media_type = 'youtube' AND youtube_video_id IS NOT NULL AND image_path IS NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_media_posts TO authenticated;
GRANT ALL ON public.wellness_media_posts TO service_role;

ALTER TABLE public.wellness_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read published media posts"
ON public.wellness_media_posts
FOR SELECT TO authenticated
USING (
  public.is_wellness_staff(auth.uid())
  OR (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.wellness_members wm
      WHERE wm.user_id = auth.uid()
        AND (wellness_media_posts.visibility = 'all' OR wellness_media_posts.visibility = wm.member_mode)
    )
  )
);

CREATE POLICY "Staff create media posts"
ON public.wellness_media_posts
FOR INSERT TO authenticated
WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Staff update media posts"
ON public.wellness_media_posts
FOR UPDATE TO authenticated
USING (public.is_wellness_staff(auth.uid()))
WITH CHECK (public.is_wellness_staff(auth.uid()));

CREATE POLICY "Staff delete media posts"
ON public.wellness_media_posts
FOR DELETE TO authenticated
USING (public.is_wellness_staff(auth.uid()));

CREATE TRIGGER wellness_media_posts_updated_at
BEFORE UPDATE ON public.wellness_media_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff upload promotion media"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promotion-media' AND public.is_wellness_staff(auth.uid()));

CREATE POLICY "Staff update promotion media"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'promotion-media' AND public.is_wellness_staff(auth.uid()))
WITH CHECK (bucket_id = 'promotion-media' AND public.is_wellness_staff(auth.uid()));

CREATE POLICY "Staff delete promotion media"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'promotion-media' AND public.is_wellness_staff(auth.uid()));