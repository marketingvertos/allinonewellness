import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsWellnessManager } from "@/hooks/useWellness";
import { Promotion, ProgressRow, useMarkPromotionReward, usePromotionAllProgress } from "@/hooks/usePromotions";
import { formatDate, formatDateTime } from "@/lib/formatters";

export function PromotionProgressSheet({ promotion, onClose }: { promotion: Promotion | null; onClose: () => void }) {
  const { data, isLoading } = usePromotionAllProgress(promotion?.id);
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState<ProgressRow | null>(null);
  const [note, setNote] = useState("");
  const mark = useMarkPromotionReward();
  const isManager = useIsWellnessManager();
  const { toast } = useToast();
  const target = promotion?.target_count ?? 1;

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data ?? []).filter((r) => !s || r.member_name.toLowerCase().includes(s) || r.mobile.includes(s));
  }, [data, search]);

  const exportCsv = () => {
    const lines = [["Member", "Mobile", "Count", "Target", "Qualified", "Qualified on", "Reward given", "Given on", "Note"]];
    for (const r of rows)
      lines.push([r.member_name, r.mobile, String(r.current_count), String(target), r.qualified ? "Yes" : "No",
        r.qualified_at ? formatDate(r.qualified_at) : "", r.reward_claimed ? "Yes" : "No",
        r.reward_claimed_at ? formatDate(r.reward_claimed_at) : "", r.notes ?? ""]);
    const csv = "\uFEFF" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `offer-progress-${promotion?.title.replace(/\W+/g, "-").toLowerCase()}.csv`;
    a.click();
  };

  const confirm = async (claimed: boolean, row: ProgressRow) => {
    try {
      await mark.mutateAsync({ progressId: row.id, claimed, note });
      toast({ title: claimed ? "Reward marked as given" : "Reward mark removed" });
      setMarking(null);
      setNote("");
    } catch (e) {
      toast({ title: "Could not update", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={!!promotion} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{promotion?.icon} {promotion?.title}</SheetTitle>
          <SheetDescription>Target: {target} · {promotion && `${formatDate(promotion.start_date)} – ${formatDate(promotion.end_date)}`}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex gap-2">
          <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /></Button>
        </div>
        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Refreshing counts…</p>}
          {!isLoading && !rows.length && <p className="text-sm text-muted-foreground">No progress yet.</p>}
          {rows.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.member_name}</p>
                  <p className="text-xs text-muted-foreground">{r.mobile}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {r.qualified && <Badge>Qualified</Badge>}
                  {r.reward_claimed && <Badge variant="secondary">Reward given</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={Math.min(100, (r.current_count / target) * 100)} className="h-2" />
                <span className="w-14 text-right text-sm font-semibold">{r.current_count}/{target}</span>
              </div>
              {r.reward_claimed && r.reward_claimed_at && (
                <p className="text-xs text-muted-foreground">Given {formatDateTime(r.reward_claimed_at)}{r.notes ? ` · ${r.notes}` : ""}</p>
              )}
              {isManager && r.qualified && (
                r.reward_claimed ? (
                  <Button size="sm" variant="ghost" onClick={() => confirm(false, r)}>Undo reward</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setMarking(r)}>Mark reward given</Button>
                )
              )}
            </div>
          ))}
        </div>
        <ResponsiveDialog
          open={!!marking}
          onOpenChange={(o) => !o && setMarking(null)}
          title="Mark reward given"
          description={marking ? `${marking.member_name} — ${promotion?.reward_description}` : ""}
          footer={
            <>
              <Button variant="outline" onClick={() => setMarking(null)}>Cancel</Button>
              <Button onClick={() => marking && confirm(true, marking)} disabled={mark.isPending}>Confirm</Button>
            </>
          }
        >
          <Textarea placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </ResponsiveDialog>
      </SheetContent>
    </Sheet>
  );
}
