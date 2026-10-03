import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, todayIst } from "@/lib/formatters";
import { CalendarCheck } from "lucide-react";

export function useTrialAttendance(trialIds: string[]) {
  return useQuery({
    queryKey: ["trial-attendance", trialIds],
    enabled: trialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("trial_id, visit_date, is_trial_advance")
        .in("trial_id", trialIds)
        .order("visit_date");
      if (error) throw error;
      const map: Record<string, { date: string; extra: boolean }[]> = {};
      for (const r of data ?? []) if (r.trial_id) (map[r.trial_id] ??= []).push({ date: r.visit_date, extra: !!r.is_trial_advance });
      return map;
    },
  });
}

export function TrialAttendanceControls({
  trialId,
  name,
  startDate,
  endDate,
  total,
  dates,
}: {
  trialId: string;
  name: string;
  startDate: string;
  endDate: string;
  total: number;
  dates: { date: string; extra: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const today = todayIst();
  const maxDate = today;
  const [date, setDate] = useState(maxDate);
  const qc = useQueryClient();
  const { toast } = useToast();
  const used = dates.filter((d) => !d.extra).length;
  const extraCount = dates.length - used;
  const full = used >= total || endDate < today;

  const mark = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_trial_attendance" as never, { p_trial_id: trialId, p_date: date } as never);
      if (error) throw error;
      return data as unknown as { status: string; message?: string; used?: number; total?: number; extra?: boolean; extra_count?: number };
    },
    onSuccess: (res) => {
      if (res.status !== "ok") {
        toast({ title: "Not marked", description: res.message, variant: "destructive" });
        return;
      }
      toast({
        title: res.extra ? "Extra visit marked" : "Attendance marked",
        description: res.extra
          ? `${name}: ${res.extra_count} extra visit(s) — deducted from the plan when they join.`
          : `${name}: ${res.used} of ${res.total} trial servings used.`,
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["trial-attendance"] });
      qc.invalidateQueries({ queryKey: ["wellness-trials-active"] });
      qc.invalidateQueries({ queryKey: ["wellness-dashboard-metrics"] });
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("attendance") });
    },
    onError: (e: Error) => toast({ title: "Not marked", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Servings used: {Math.min(used, total)} of {total}</span>
        <Button size="sm" variant="outline" onClick={() => { setDate(maxDate); setOpen(true); }}>
          <CalendarCheck className="mr-2 h-4 w-4" /> {full ? "Mark extra visit" : "Mark attendance"}
        </Button>
      </div>
      {extraCount > 0 && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {extraCount} extra visit{extraCount === 1 ? "" : "s"} — will be deducted when they join
        </p>
      )}
      {dates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Marked: {dates.map((d) => formatDate(d.date) + (d.extra ? " (extra)" : "")).join(", ")}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark attendance</DialogTitle>
            <DialogDescription>
              {name} — trial {formatDate(startDate)} to {formatDate(endDate)}.{" "}
              {full
                ? "Trial servings are used up, so this is an extra visit — 1 serving will be deducted from their plan when they join."
                : "This uses 1 trial serving. Visits after the trial ends count as extra visits."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor={`ta-${trialId}`}>Visit date</Label>
            <Input id={`ta-${trialId}`} type="date" min={startDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!date || mark.isPending} onClick={() => mark.mutate()}>
              {mark.isPending ? "Marking…" : "Mark present"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
