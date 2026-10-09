import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MediaPostVisibility = "all" | "physical" | "virtual";
export type MediaPostType = "image" | "youtube";

export interface MediaPost {
  id: string;
  media_type: MediaPostType;
  image_path: string | null;
  youtube_video_id: string | null;
  caption: string | null;
  visibility: MediaPostVisibility;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
}

const withSignedImages = async (posts: MediaPost[]) => Promise.all(posts.map(async (post) => {
  if (!post.image_path) return { ...post, image_url: null };
  const { data } = await supabase.storage.from("promotion-media").createSignedUrl(post.image_path, 3600);
  return { ...post, image_url: data?.signedUrl ?? null };
}));

export function useMediaPosts() {
  return useQuery({
    queryKey: ["media-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wellness_media_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return withSignedImages((data ?? []) as MediaPost[]);
    },
  });
}

export function useMemberMediaPosts(memberMode?: string) {
  return useQuery({
    queryKey: ["member-media-posts", memberMode],
    queryFn: async () => {
      let query = supabase.from("wellness_media_posts").select("*").eq("is_published", true).order("published_at", { ascending: false });
      if (memberMode) query = query.or(`visibility.eq.all,visibility.eq.${memberMode}`);
      const { data, error } = await query;
      if (error) throw error;
      return withSignedImages((data ?? []) as MediaPost[]);
    },
  });
}

export type MediaPostInput = Pick<MediaPost, "media_type" | "image_path" | "youtube_video_id" | "caption" | "visibility" | "is_published" | "published_at">;

export function useSaveMediaPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: MediaPostInput }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Please sign in again.");
      if (id) {
        const { error } = await supabase.from("wellness_media_posts").update({ ...values, updated_by: userId }).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("wellness_media_posts").insert({ ...values, created_by: userId, updated_by: userId }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-posts"] });
      queryClient.invalidateQueries({ queryKey: ["member-media-posts"] });
    },
  });
}

export function useDeleteMediaPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: MediaPost) => {
      const { error } = await supabase.from("wellness_media_posts").delete().eq("id", post.id);
      if (error) throw error;
      if (post.image_path) await supabase.storage.from("promotion-media").remove([post.image_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-posts"] });
      queryClient.invalidateQueries({ queryKey: ["member-media-posts"] });
    },
  });
}