CREATE TABLE public.wellness_media_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wellness_media_posts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, member_id)
);
CREATE TABLE public.wellness_media_post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wellness_media_posts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wellness_media_post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wellness_media_posts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.wellness_members(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.wellness_media_post_views(post_id, viewed_at);
CREATE INDEX ON public.wellness_media_post_shares(post_id);

GRANT SELECT, INSERT, DELETE ON public.wellness_media_post_likes TO authenticated;
GRANT SELECT, INSERT ON public.wellness_media_post_views TO authenticated;
GRANT SELECT, INSERT ON public.wellness_media_post_shares TO authenticated;
GRANT ALL ON public.wellness_media_post_likes, public.wellness_media_post_views, public.wellness_media_post_shares TO service_role;

ALTER TABLE public.wellness_media_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_media_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_media_post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or staff read likes" ON public.wellness_media_post_likes FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "member likes published" ON public.wellness_media_post_likes FOR INSERT TO authenticated
  WITH CHECK (public.owns_wellness_member(auth.uid(), member_id)
    AND EXISTS (SELECT 1 FROM public.wellness_media_posts p WHERE p.id = post_id AND p.is_published));
CREATE POLICY "member unlikes own" ON public.wellness_media_post_likes FOR DELETE TO authenticated
  USING (public.owns_wellness_member(auth.uid(), member_id));

CREATE POLICY "own or staff read views" ON public.wellness_media_post_views FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "member records view" ON public.wellness_media_post_views FOR INSERT TO authenticated
  WITH CHECK (public.owns_wellness_member(auth.uid(), member_id)
    AND EXISTS (SELECT 1 FROM public.wellness_media_posts p WHERE p.id = post_id AND p.is_published));

CREATE POLICY "own or staff read shares" ON public.wellness_media_post_shares FOR SELECT TO authenticated
  USING (public.is_wellness_staff(auth.uid()) OR public.owns_wellness_member(auth.uid(), member_id));
CREATE POLICY "member records share" ON public.wellness_media_post_shares FOR INSERT TO authenticated
  WITH CHECK (public.owns_wellness_member(auth.uid(), member_id)
    AND EXISTS (SELECT 1 FROM public.wellness_media_posts p WHERE p.id = post_id AND p.is_published));

CREATE OR REPLACE FUNCTION public.media_post_stats(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(post_id uuid, views bigint, unique_viewers bigint, likes bigint, shares bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_wellness_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT p.id,
    (SELECT count(*) FROM wellness_media_post_views v WHERE v.post_id = p.id AND v.viewed_at BETWEEN p_from AND p_to),
    (SELECT count(DISTINCT v.member_id) FROM wellness_media_post_views v WHERE v.post_id = p.id AND v.viewed_at BETWEEN p_from AND p_to),
    (SELECT count(*) FROM wellness_media_post_likes l WHERE l.post_id = p.id AND l.created_at BETWEEN p_from AND p_to),
    (SELECT count(*) FROM wellness_media_post_shares s WHERE s.post_id = p.id AND s.created_at BETWEEN p_from AND p_to)
  FROM wellness_media_posts p;
END $$;

CREATE OR REPLACE FUNCTION public.member_media_like_counts()
RETURNS TABLE(post_id uuid, likes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.post_id, count(*) FROM wellness_media_post_likes l
  JOIN wellness_media_posts p ON p.id = l.post_id AND p.is_published
  WHERE auth.uid() IS NOT NULL GROUP BY l.post_id
$$;

REVOKE EXECUTE ON FUNCTION public.media_post_stats(timestamptz, timestamptz) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.member_media_like_counts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.media_post_stats(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_media_like_counts() TO authenticated;