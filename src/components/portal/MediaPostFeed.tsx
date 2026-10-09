import { Card, CardContent } from "@/components/ui/card";
import { useMemberMediaPosts } from "@/hooks/useMediaPosts";
import { youtubeEmbedUrl } from "@/lib/youtube";

export function MediaPostFeed({ memberMode }: { memberMode?: string }) {
  const { data: posts } = useMemberMediaPosts(memberMode);
  if (!posts?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Updates</h2>
      {posts.map((post) => (
        <Card key={post.id} className="overflow-hidden">
          {post.media_type === "image" && post.image_url && <img src={post.image_url} alt={post.caption || "Member update"} className="max-h-[32rem] w-full object-contain" />}
          {post.media_type === "youtube" && post.youtube_video_id && (
            <div className="aspect-video"><iframe className="h-full w-full" src={youtubeEmbedUrl(post.youtube_video_id)} title={post.caption || "Member video"} allow="encrypted-media; picture-in-picture" allowFullScreen /></div>
          )}
          {post.caption && <CardContent className="pt-4"><p className="whitespace-pre-line text-sm">{post.caption}</p></CardContent>}
        </Card>
      ))}
    </section>
  );
}