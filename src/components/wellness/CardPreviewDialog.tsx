import { useState, useEffect, useCallback } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  buildPdf: () => Promise<{ blob: Blob; fileName: string }>;
}

export function CardPreviewDialog({ open, onOpenChange, title, buildPdf }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!open) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setBlob(null);
      setFileName("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    buildPdf().then((result) => {
      if (cancelled) return;
      const url = URL.createObjectURL(result.blob);
      setBlobUrl(url);
      setBlob(result.blob);
      setFileName(result.fileName);
    }).catch(() => {
      if (!cancelled) setBlobUrl(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  const handleDownload = useCallback(() => {
    if (!blob || !fileName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [blob, fileName]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} description="Preview and download">
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Generating PDF…</span>
          </div>
        ) : blobUrl ? (
          <>
            <iframe src={blobUrl} className="h-[65vh] w-full rounded border" title={title} />
            <Button onClick={handleDownload} className="gap-2 self-end">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-muted-foreground">Could not generate preview.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
