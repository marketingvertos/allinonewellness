import { useEffect, useState } from "react";
import { Image, Youtube } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MediaPost, MediaPostType, MediaPostVisibility, useSaveMediaPost } from "@/hooks/useMediaPosts";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeVideoId, youtubeEmbedUrl } from "@/lib/youtube";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: MediaPostType;
  post?: MediaPost | null;
}

export function MediaPostDialog({ open, onOpenChange, type, post }: Props) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<MediaPostVisibility>("all");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const save = useSaveMediaPost();
  const { toast } = useToast();
  const videoId = type === "youtube" ? getYouTubeVideoId(youtubeUrl) : null;

  useEffect(() => {
    if (!open) return;
    setCaption(post?.caption ?? "");
    setVisibility(post?.visibility ?? "all");
    setYoutubeUrl(post?.youtube_video_id ? `https://www.youtube.com/watch?v=${post.youtube_video_id}` : "");
    setFile(null);
    setPreview(post?.image_url ?? null);
  }, [open, post]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const chooseFile = (next: File | null) => {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      toast({ title: "Choose a JPG, PNG or WebP image", variant: "destructive" });
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be 10 MB or smaller", variant: "destructive" });
      return;
    }
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = async (publish: boolean) => {
    if (type === "youtube" && !videoId) {
      toast({ title: "Enter a valid YouTube or Shorts link", variant: "destructive" });
      return;
    }
    if (type === "image" && !file && !post?.image_path) {
      toast({ title: "Choose an image", variant: "destructive" });
      return;
    }

    setPublishing(true);
    let imagePath = post?.image_path ?? null;
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedPath = `${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("promotion-media").upload(uploadedPath, file, { contentType: file.type });
        if (error) throw error;
        imagePath = uploadedPath;
      }
      await save.mutateAsync({
        id: post?.id,
        values: {
          media_type: type,
          image_path: type === "image" ? imagePath : null,
          youtube_video_id: type === "youtube" ? videoId : null,
          caption: caption.trim() || null,
          visibility,
          is_published: publish,
          published_at: publish ? (post?.published_at ?? new Date().toISOString()) : null,
        },
      });
      if (uploadedPath && post?.image_path && uploadedPath !== post.image_path) {
        await supabase.storage.from("promotion-media").remove([post.image_path]);
      }
      toast({ title: publish ? "Post published" : "Draft saved" });
      onOpenChange(false);
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("promotion-media").remove([uploadedPath]);
      toast({ title: "Could not save post", description: (error as Error).message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const isEditingPublished = !!post?.is_published;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={post ? "Edit media post" : type === "image" ? "Upload image post" : "Add YouTube video"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={publishing}>Save draft</Button>
          <Button onClick={() => submit(true)} disabled={publishing}>{isEditingPublished ? "Save published post" : "Publish"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {type === "image" ? (
          <div className="space-y-2">
            <Label htmlFor="media-image">Image</Label>
            <Input id="media-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            {preview ? <img src={preview} alt="Post preview" className="max-h-72 w-full rounded-md border object-contain" /> : (
              <div className="flex h-36 items-center justify-center rounded-md border border-dashed text-muted-foreground"><Image className="h-8 w-8" /></div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube or Shorts link</Label>
            <Input id="youtube-url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtu.be/..." />
            {videoId ? (
              <div className="aspect-video overflow-hidden rounded-md border">
                <iframe className="h-full w-full" src={youtubeEmbedUrl(videoId)} title="YouTube preview" allow="encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md border border-dashed text-muted-foreground"><Youtube className="h-8 w-8" /></div>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="media-caption">Caption (optional)</Label>
          <Textarea id="media-caption" value={caption} onChange={(event) => setCaption(event.target.value)} rows={4} placeholder="Write a caption, or publish without one." />
        </div>
        <div className="space-y-2">
          <Label>Show to</Label>
          <Select value={visibility} onValueChange={(value) => setVisibility(value as MediaPostVisibility)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="physical">Physical members</SelectItem>
              <SelectItem value="virtual">Virtual members</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ResponsiveDialog>
  );
}