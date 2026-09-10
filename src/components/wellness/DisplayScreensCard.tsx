import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Tv } from "lucide-react";

const SCREENS = [
  { label: "Weight progress board", path: "/display/weight-changes" },
  { label: "Milestone board", path: "/display/milestones" },
];

/** Copyable links to the public TV display boards. */
export function DisplayScreensCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="h-4 w-4 text-primary" /> Display screens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {SCREENS.map((s) => {
          const url = `${origin}${s.path}`;
          return (
            <div key={s.path} className="rounded-md border p-3">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">{url}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(url)}>
                  {copied === url ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied === url ? "Copied" : "Copy link"}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={s.path} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Open on any TV or tablet — no login needed, refreshes every 60 seconds.
        </p>
      </CardContent>
    </Card>
  );
}
