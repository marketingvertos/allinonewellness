import { useState } from "react";
import { Eye, Heart, Pencil, Share2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MediaPost, MediaPostType, useDeleteMediaPost, useMediaPostEngagement, useMediaPostStats, useMediaPosts, useSaveMediaPost } from "@/hooks/useMediaPosts";
import { MediaPostDialog } from "@/components/wellness/MediaPostDialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { youtubeEmbedUrl } from "@/lib/youtube";

interface Props {
  createType: MediaPostType | null;
  onCreateHandled: () => void;
}

export function MediaPostsManager({ createType, onCreateHandled }: Props) {
  const { data: posts, isLoading } = useMediaPosts();
  const { data: stats } = useMediaPostStats(30);
  const save = useSaveMediaPost();
  const remove = useDeleteMediaPost();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ type: MediaPostType; post?: MediaPost } | null>(null);
  const [deleting, setDeleting] = useState<MediaPost | null>(null);
  const [engagementFor, setEngagementFor] = useState<MediaPost | null>(null);
  const { data: engagement, isLoading: engLoading } = useMediaPostEngagement(engagementFor?.id ?? null);

  const active = createType ? { type: createType } : dialog;

  const totals = [...(stats?.values() ?? [])].reduce(
    (a, s) => ({ views: a.views + s.views, unique: a.unique + s.unique_viewers, likes: a.likes + s.likes, shares: a.shares + s.shares }),
    { views: 0, unique: 0, likes: 0, shares: 0 },
  );

  const togglePublished = async (post: MediaPost) => {
    try {
      const publish = !post.is_published;
      await save.mutateAsync({
        id: post.id,
        values: {
          media_type: post.media_type,
          image_path: post.image_path,
          youtube_video_id: post.youtube_video_id,
          caption: post.caption,
          visibility: post.visibility,
          is_published: publish,
          published_at: publish ? new Date().toISOString() : null,
        },
      });
      toast({ title: publish ? "Post published" : "Post unpublished" });
    } catch (error) {
      toast({ title: "Could not update post", description: (error as Error).message, variant: "destructive" });
    }
  };

  const tiles = [
    { label: "Total views", value: totals.views, icon: Eye },
    { label: "Unique members", value: totals.unique, icon: Users },
    { label: "Likes", value: totals.likes, icon: Heart },
    { label: "WhatsApp shares", value: totals.shares, icon: Share2 },
  ];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Engagement in the last 30 days (unique members counted per post).</p>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <t.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-semibold">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading media posts…</p>}
      {!isLoading && !posts?.length && <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No media posts yet. Use the buttons at the top to add one.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {(posts ?? []).map((post) => {
          const s = stats?.get(post.id);
          return (
            <Card key={post.id} className="overflow-hidden">
              {post.media_type === "image" && post.image_url && <img src={post.image_url} alt={post.caption || "Media post"} className="aspect-video w-full object-cover" />}
              {post.media_type === "youtube" && post.youtube_video_id && (
                <div className="aspect-video"><iframe className="h-full w-full" src={youtubeEmbedUrl(post.youtube_video_id)} title={post.caption || "YouTube video"} allow="encrypted-media; picture-in-picture" allowFullScreen /></div>
              )}
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={post.is_published ? "default" : "secondary"}>{post.is_published ? "Published" : "Draft"}</Badge>
                  <Badge variant="outline" className="capitalize">{post.visibility}</Badge>
                  <span className="text-xs text-muted-foreground">{post.published_at ? formatDateTime(post.published_at) : formatDateTime(post.created_at)}</span>
                </div>
                {post.caption && <p className="whitespace-pre-line text-sm">{post.caption}</p>}
                <button
                  type="button"
                  onClick={() => setEngagementFor(post)}
                  className="flex flex-wrap gap-3 rounded-md border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
                >
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{s?.views ?? 0} views</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s?.unique_viewers ?? 0} members</span>
                  <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{s?.likes ?? 0}</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{s?.shares ?? 0}</span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => togglePublished(post)} disabled={save.isPending}>{post.is_published ? "Unpublish" : "Publish"}</Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ type: post.media_type, post })}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button size="icon" variant="ghost" aria-label="Delete post" title="Delete post" onClick={() => setDeleting(post)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {active && (
        <MediaPostDialog
          open
          onOpenChange={(open) => { if (!open) { setDialog(null); onCreateHandled(); } }}
          type={active.type}
          post={"post" in active ? active.post : undefined}
        />
      )}

      <Sheet open={!!engagementFor} onOpenChange={(o) => !o && setEngagementFor(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Post engagement</SheetTitle>
            <SheetDescription>Members who liked or shared this post.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {engLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : !engagement?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No likes or shares yet.</p>
              : engagement.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {r.kind === "like" ? <Heart className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4 text-primary" />}
                    {r.member}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.at)}</span>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media post?</AlertDialogTitle>
            <AlertDialogDescription>The post and its uploaded image will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleting) return;
              try { await remove.mutateAsync(deleting); toast({ title: "Post deleted" }); setDeleting(null); }
              catch (error) { toast({ title: "Could not delete post", description: (error as Error).message, variant: "destructive" }); }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
