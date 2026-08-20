import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the extracted centre code (the `c` query param) or the raw scan text. */
  onResult: (code: string) => void;
  title?: string;
  description?: string;
}

/** Pulls the centre check-in code out of a scanned URL, or returns the raw text. */
export function extractCheckinCode(text: string): string {
  try {
    const url = new URL(text);
    return url.searchParams.get("c") ?? text.trim();
  } catch {
    return text.trim();
  }
}

export function QrScannerSheet({ open, onOpenChange, onResult, title, description }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    handled.current = false;
    setError(null);
    setStarting(true);

    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result) => {
          if (!result || handled.current) return;
          handled.current = true;
          const code = extractCheckinCode(result.getText());
          controlsRef.current?.stop();
          onOpenChange(false);
          onResult(code);
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStarting(false);
        setError("We could not open the camera. Allow camera access in your browser, or enter the code below.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onOpenChange, onResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? "Scan check-in QR"}</DialogTitle>
          <DialogDescription>
            {description ?? "Point your camera at the QR poster at the centre."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border bg-muted aspect-square">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Label htmlFor="manual-code">Or enter the centre code</Label>
          <div className="flex gap-2">
            <Input
              id="manual-code"
              value={manual}
              placeholder="Code printed under the QR"
              onChange={(e) => setManual(e.target.value)}
            />
            <Button
              disabled={!manual.trim()}
              onClick={() => {
                const code = extractCheckinCode(manual);
                setManual("");
                onOpenChange(false);
                onResult(code);
              }}
            >
              Use
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
