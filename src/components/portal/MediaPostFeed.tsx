import { useEffect, useRef } from "react";
import { Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MediaPost,
  recordMediaShare,
  recordMediaView,
  useMemberMediaLikes,
  useMemberMediaPosts,
  useToggleMediaLike,
} from "@/hooks/useMediaPosts";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const viewedThisSession = new Set<string>();

function useViewTracker(postId: string, memberId?: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !memberId || viewedThisSession.has(postId)) return;
    let timer: number | undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => {
            if (viewedThisSession.has(postId)) return;
            viewedThisSession.add(postId);
            void recordMediaView(postId, memberId);
            obs.disconnect();
          }, 1000);
        } else if (timer) {
          window.clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [postId, memberId]);
  return ref;
}

async function shareToWhatsApp(post: MediaPost) {
  const caption = post.caption?.trim() ?? "";
  const videoLink = post.youtube_video_id ? `https://youtu.be/${post.youtube_video_id}` : "";
  const text = [caption, videoLink].filter(Boolean).join("\n\n");

  if (post.media_type === "image" && post.image_url && navigator.share) {
    try {
      const blob = await (await fetch(post.image_url)).blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const file = new File([blob], `update.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption || undefined });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text || "All In One Wellness update")}`, "_blank");
}

function PostCard({ post, memberId, liked, likes, onLike }: {
  post: MediaPost; memberId?: string; liked: boolean; likes: number; onLike: () => void;
}) {
  const ref = useViewTracker(post.id, memberId);
  const share = async () => {
    try {
      await shareToWhatsApp(post);
      if (memberId) void recordMediaShare(post.id, memberId);
    } catch {
      /* member cancelled the share sheet */
    }
  };

  return (
    <Card ref={ref} className="overflow-hidden">
      {post.media_type === "image" && post.image_url && <img src={post.image_url} alt={post.caption || "Member update"} className="max-h-[32rem] w-full object-contain" />}
      {post.media_type === "youtube" && post.youtube_video_id && (
        <div className="aspect-video"><iframe className="h-full w-full" src={youtubeEmbedUrl(post.youtube_video_id)} title={post.caption || "Member video"} allow="encrypted-media; picture-in-picture" allowFullScreen /></div>
      )}
      <CardContent className="space-y-3 pt-4">
        {post.caption && <p className="whitespace-pre-line text-sm">{post.caption}</p>}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onLike} disabled={!memberId} aria-pressed={liked}>
            <Heart className={cn("mr-1 h-4 w-4", liked && "fill-primary text-primary")} />
            {likes > 0 ? likes : ""} {liked ? "Liked" : "Like"}
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="mr-1 h-4 w-4" /> Share on WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MediaPostFeed({ memberMode, memberId }: { memberMode?: string; memberId?: string }) {
  const { data: posts } = useMemberMediaPosts(memberMode);
  const { data: likeData } = useMemberMediaLikes(memberId);
  const toggle = useToggleMediaLike(memberId);
  if (!posts?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Updates</h2>
      {posts.map((post) => {
        const liked = likeData?.mine.has(post.id) ?? false;
        return (
          <PostCard
            key={post.id}
            post={post}
            memberId={memberId}
            liked={liked}
            likes={likeData?.total.get(post.id) ?? 0}
            onLike={() => toggle.mutate({ postId: post.id, liked })}
          />
        );
      })}
    </section>
  );
}
