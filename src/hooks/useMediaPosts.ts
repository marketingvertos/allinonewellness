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

/* ------------------------------ Engagement ------------------------------ */

export interface MediaPostStat { post_id: string; views: number; unique_viewers: number; likes: number; shares: number }

export function useMediaPostStats(days = 30) {
  return useQuery({
    queryKey: ["media-post-stats", days],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86400000);
      const { data, error } = await supabase.rpc("media_post_stats" as never, { p_from: from.toISOString(), p_to: to.toISOString() } as never);
      if (error) throw error;
      const map = new Map<string, MediaPostStat>();
      for (const r of (data ?? []) as MediaPostStat[]) map.set(r.post_id, { ...r, views: Number(r.views), unique_viewers: Number(r.unique_viewers), likes: Number(r.likes), shares: Number(r.shares) });
      return map;
    },
  });
}

export interface EngagementRow { kind: "like" | "share"; member: string; at: string }

export function useMediaPostEngagement(postId: string | null) {
  return useQuery({
    queryKey: ["media-post-engagement", postId],
    enabled: !!postId,
    queryFn: async () => {
      const [likes, shares] = await Promise.all([
        supabase.from("wellness_media_post_likes").select("created_at, wellness_members(full_name)").eq("post_id", postId!),
        supabase.from("wellness_media_post_shares").select("created_at, wellness_members(full_name)").eq("post_id", postId!),
      ]);
      if (likes.error) throw likes.error;
      if (shares.error) throw shares.error;
      type R = { created_at: string; wellness_members: { full_name?: string } | null };
      const rows: EngagementRow[] = [
        ...((likes.data ?? []) as unknown as R[]).map((r) => ({ kind: "like" as const, member: r.wellness_members?.full_name ?? "Member", at: r.created_at })),
        ...((shares.data ?? []) as unknown as R[]).map((r) => ({ kind: "share" as const, member: r.wellness_members?.full_name ?? "Member", at: r.created_at })),
      ];
      return rows.sort((a, b) => b.at.localeCompare(a.at));
    },
  });
}

export function useMemberMediaLikes(memberId?: string) {
  return useQuery({
    queryKey: ["member-media-likes", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const [counts, mine] = await Promise.all([
        supabase.rpc("member_media_like_counts" as never),
        supabase.from("wellness_media_post_likes").select("post_id").eq("member_id", memberId!),
      ]);
      if (counts.error) throw counts.error;
      const total = new Map<string, number>();
      for (const r of (counts.data ?? []) as { post_id: string; likes: number }[]) total.set(r.post_id, Number(r.likes));
      return { total, mine: new Set((mine.data ?? []).map((r) => r.post_id)) };
    },
  });
}

export function useToggleMediaLike(memberId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!memberId) throw new Error("Member not found");
      const res = liked
        ? await supabase.from("wellness_media_post_likes").delete().eq("post_id", postId).eq("member_id", memberId)
        : await supabase.from("wellness_media_post_likes").insert({ post_id: postId, member_id: memberId });
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["member-media-likes"] }),
  });
}

export async function recordMediaView(postId: string, memberId: string) {
  await supabase.from("wellness_media_post_views").insert({ post_id: postId, member_id: memberId });
}

export async function recordMediaShare(postId: string, memberId: string) {
  await supabase.from("wellness_media_post_shares").insert({ post_id: postId, member_id: memberId, channel: "whatsapp" });
}