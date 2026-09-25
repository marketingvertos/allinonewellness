import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsWellnessAdmin } from "@/hooks/useWellness";
import { formatDateTime, todayIst } from "@/lib/formatters";
import { Download, ExternalLink, Loader2, RefreshCw, Sheet } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

async function call(action: string) {
  const { data, error } = await supabase.functions.invoke("sync-sheets", { body: { action } });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details).error ?? details; } catch { /* plain text */ }
    throw new Error(msg);
  }
  return data;
}

export function BackupSettings() {
  const isAdmin = useIsWellnessAdmin();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { data: status } = useQuery({
    queryKey: ["sheets-backup-status"],
    enabled: isAdmin,
    queryFn: () => call("status") as Promise<{ url: string | null; lastSyncAt: string | null; lastStatus: string | null }>,
  });

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only admins can manage backups.</p>;

  const syncNow = async () => {
    setSyncing(true);
    try {
      await call("sync");
      toast.success("Google Sheet updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
      qc.invalidateQueries({ queryKey: ["sheets-backup-status"] });
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      const { tabs } = (await call("export")) as { tabs: Record<string, (string | number)[][]> };
      const wb = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(tabs)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31));
      XLSX.writeFile(wb, `aiow-crm-backup-${todayIst()}.xlsx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const ok = status?.lastStatus === "ok";
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sheet className="h-5 w-5" /> Live Google Sheet</CardTitle>
          <CardDescription>All members, memberships, payments, attendance, servings, weights, achievements and Pink Card history — refreshed every 15 minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Last sync:</span>
            <span>{status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : "Not yet"}</span>
            {status?.lastStatus && <Badge variant={ok ? "default" : "destructive"}>{ok ? "Worked" : "Failed"}</Badge>}
          </div>
          {status?.lastStatus && !ok && <p className="text-sm text-destructive break-words">{status.lastStatus}</p>}
          <div className="flex flex-wrap gap-2">
            {status?.url && (
              <Button variant="secondary" asChild>
                <a href={status.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Open sheet</a>
              </Button>
            )}
            <Button onClick={syncNow} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Sync now
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Download full backup</CardTitle>
          <CardDescription>One Excel file with the same 11 tabs, downloaded to this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={download} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download Excel backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
