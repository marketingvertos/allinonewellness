import { QRCodeSVG } from "qrcode.react";
import { useCentreSettings, useRotateCheckinCode } from "@/hooks/useWellness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/formatters";
import { Printer, RefreshCw } from "lucide-react";

export function CentreQrCard() {
  const { data: settings, isLoading } = useCentreSettings();
  const rotate = useRotateCheckinCode();

  const url = settings ? `${window.location.origin}/portal/checkin?c=${settings.checkin_code}` : "";

  return (
    <Card className="print:shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Centre check-in QR</CardTitle>
        <CardDescription>
          Print and display this at the front desk. Members scan it from the portal to record today&apos;s visit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {isLoading || !settings ? (
          <Skeleton className="h-44 w-44" />
        ) : (
          <>
            <div className="rounded-lg border bg-background p-4">
              <QRCodeSVG value={url} size={176} includeMargin={false} />
            </div>
            <p className="text-xs text-muted-foreground">
              Rotated {formatDateTime(settings.code_rotated_at)}
            </p>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={rotate.isPending}
                onClick={() => rotate.mutate()}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> New code
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
