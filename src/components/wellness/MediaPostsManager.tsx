import { useState } from "react";
import { Image, Pencil, Trash2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MediaPost, MediaPostType, useDeleteMediaPost, useMediaPosts, useSaveMediaPost } from "@/hooks/useMediaPosts";
import { MediaPostDialog } from "@/components/wellness/MediaPostDialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { youtubeEmbedUrl } from "@/lib/youtube";

export function MediaPostsManager() {
  const { data: posts, isLoading } = useMediaPosts();
  const save = useSaveMediaPost();
  const remove = useDeleteMediaPost();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ type: MediaPostType; post?: MediaPost } | null>(null);
  const [deleting, setDeleting] = useState<MediaPost | null>(null);

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

  return (
    <section className="mt-8 border-t pt-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Media posts</h2>
          <p className="text-sm text-muted-foreground">Publish images or YouTube videos on the member app.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog({ type: "image" })}><Image className="mr-2 h-4 w-4" /> Upload image</Button>
          <Button variant="outline" onClick={() => setDialog({ type: "youtube" })}><Youtube className="mr-2 h-4 w-4" /> Add YouTube video</Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading media posts…</p>}
      {!isLoading && !posts?.length && <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No media posts yet.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {(posts ?? []).map((post) => (
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
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => togglePublished(post)} disabled={save.isPending}>{post.is_published ? "Unpublish" : "Publish"}</Button>
                <Button size="sm" variant="outline" onClick={() => setDialog({ type: post.media_type, post })}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="icon" variant="ghost" aria-label="Delete post" title="Delete post" onClick={() => setDeleting(post)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dialog && <MediaPostDialog open onOpenChange={(open) => !open && setDialog(null)} type={dialog.type} post={dialog.post} />}
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