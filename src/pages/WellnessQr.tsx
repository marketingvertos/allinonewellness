import { BrandLogo } from "@/components/BrandLogo";
import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useCentreSettings, useRotateCheckinCode } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { Copy, Download, Printer, RefreshCw } from "lucide-react";

export default function WellnessQr() {
  const { data: settings, isLoading } = useCentreSettings();
  const rotate = useRotateCheckinCode();
  const { toast } = useToast();
  const posterRef = useRef<HTMLDivElement>(null);

  const url = settings ? `${window.location.origin}/portal/checkin?c=${settings.checkin_code}` : "";

  const downloadPng = () => {
    const svg = posterRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 32, 32, size - 64, size - 64);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "centre-checkin-qr.png";
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageBanner
          title="Check-in QR code"
          description="Print this poster and place it at the front desk. Members scan it and their request appears in the approval queue — a serving is deducted only after your team approves it."
        >
          <Button className="w-full sm:w-auto" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print poster
          </Button>
        </PageBanner>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] print:block">
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-3 sm:p-6 print:p-0">
            {isLoading || !settings ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div
                ref={posterRef}
                className="flex w-full flex-col items-center gap-4 rounded-xl border p-4 text-center sm:p-8 print:border-0"
              >
                <BrandLogo className="h-16 w-16" />
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  All In One Wellness · Family Health Club
                </p>
                <h2 className="font-display text-xl font-bold sm:text-2xl">Scan to mark attendance</h2>
                <div className="w-full max-w-[260px] rounded-xl border bg-background p-3 sm:p-4">
                  <QRCodeSVG value={url} size={260} includeMargin={false} className="h-auto w-full" />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Open your phone camera, scan the code, sign in once — your visit is recorded instantly.</p>
                  <p lang="hi">फ़ोन कैमरे से कोड स्कैन करें — आपकी उपस्थिति अपने आप दर्ज हो जाएगी।</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Code details</CardTitle>
              <CardDescription>
                {settings ? `Last rotated ${formatDateTime(settings.code_rotated_at)}` : "Loading…"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">{url || "—"}</p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link copied" });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy link
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPng}>
                  <Download className="mr-2 h-4 w-4" /> Download PNG
                </Button>
                <Button variant="outline" size="sm" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate new code
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generating a new code instantly invalidates the printed poster — reprint it afterwards.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Member scans the poster with their phone camera.</p>
              <p>2. They sign in with the mobile number and password the front desk gave them.</p>
              <p>3. Your team approves the request — attendance is recorded and one serving is deducted.</p>
              <p>4. Members can only check in — plans, balances and records stay staff-controlled.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
