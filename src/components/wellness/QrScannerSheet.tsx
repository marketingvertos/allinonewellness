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

function cameraErrorMessage(err: unknown): string {
  const name = (err as DOMException)?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access is blocked. Allow camera for this site in your browser settings, then try again — or enter the centre code below.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Enter the centre code below instead.";
    case "NotReadableError":
      return "The camera is already in use by another app. Close it and try again, or enter the centre code below.";
    default:
      return "We could not open the camera. Try again, or enter the centre code below.";
  }
}

export function QrScannerSheet({ open, onOpenChange, onResult, title, description }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handled = useRef(false);

  // Keep callbacks in refs so the scanner effect only reruns when `open` changes.
  const onResultRef = useRef(onResult);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onResultRef.current = onResult;
    onOpenChangeRef.current = onOpenChange;
  });

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;

    handled.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const stopAll = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const start = async () => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) {
        setStarting(false);
        setError("Cameras only work on a secure (https) page. Open the app over https, or enter the centre code below.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError("This browser does not allow camera access here. Enter the centre code below instead.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setError(cameraErrorMessage(err));
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* some browsers resolve playback via autoPlay instead */
      }

      if (cancelled) {
        stopAll();
        return;
      }
      setStarting(false);

      try {
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (!result || handled.current) return;
          handled.current = true;
          const code = extractCheckinCode(result.getText());
          stopAll();
          onOpenChangeRef.current(false);
          onResultRef.current(code);
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (cancelled) return;
        setError("We could not start scanning. Enter the centre code below instead.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open]);

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
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
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
