import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "vertos-install-dismissed";

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    if (isIos && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">Install the app on your phone</p>
        {deferred ? (
          <>
            <p className="text-xs text-muted-foreground">
              Add it to your home screen for one-tap check-ins.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
                close();
              }}
            >
              Install
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Tap <Share className="h-3.5 w-3.5" /> Share, then &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
      </div>
      <button aria-label="Dismiss" onClick={close} className="text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
