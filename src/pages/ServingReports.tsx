import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Package, Search, TrendingUp, Users } from "lucide-react";
import { MemberModeFilter, periodRange, useServingsIssuedReport } from "@/hooks/useWellness";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { formatDate, formatDateTime, todayIst } from "@/lib/formatters";

type Period = "today" | "week" | "month" | "last_month" | "custom";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "custom", label: "Custom" },
];
const MODES: { key: MemberModeFilter; label: string }[] = [
  { key: "physical", label: "Physical" },
  { key: "virtual", label: "Virtual" },
  { key: "all", label: "All" },
];

export default function ServingReports() {
  const [mode, setMode] = useState<MemberModeFilter>("all");
  const [period, setPeriod] = useState<Period>("today");
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState(todayIst().slice(0, 8) + "01");
  const [customTo, setCustomTo] = useState(todayIst());
  const [selected, setSelected] = useState<string | null>(null);

  const range = period === "custom" ? { from: customFrom, to: customTo } : periodRange(period);
  const { data, isLoading } = useServingsIssuedReport(range.from, range.to, mode);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.rows ?? [];
    if (!q) return all;
    return all.filter((r) => r.memberName.toLowerCase().includes(q) || r.mobile.includes(q) || r.planName.toLowerCase().includes(q));
  }, [data, search]);

  const memberWise = useMemo(() => {
    const map: Record<string, { memberId: string; name: string; mobile: string; total: number; count: number }> = {};
    for (const r of rows) {
      const m = (map[r.memberId] ??= { memberId: r.memberId, name: r.memberName, mobile: r.mobile, total: 0, count: 0 });
      m.total += r.quantity;
      m.count += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalServings = rows.reduce((s, r) => s + r.quantity, 0);

  const exportCsv = () => {
    const header = ["Member", "Mobile", "Plan", "Servings", "Reason", "Issued at", "Dates covered"];
    const lines = rows.map((r) => [r.memberName, r.mobile, r.planName, r.quantity, r.reason ?? "", formatDateTime(r.issuedAt), r.markedDates.map((d) => formatDate(d)).join("; ")]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `serving-report-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Serving Reports</h1>
          <p className="text-sm text-muted-foreground">Packed and issued servings, by day and by member.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <Button key={m.key} size="sm" variant={mode === m.key ? "default" : "outline"} onClick={() => setMode(m.key)}>{m.label}</Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search member, mobile, plan" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button key={p.key} size="sm" variant={period === p.key ? "secondary" : "ghost"} onClick={() => setPeriod(p.key)}>{p.label}</Button>
        ))}
      </div>
      {period === "custom" && (
        <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sr-from">From</Label>
            <Input id="sr-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sr-to">To</Label>
            <Input id="sr-to" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Tile icon={<Package className="h-4 w-4 text-primary" />} label="Total servings" value={totalServings} />
        <Tile icon={<Users className="h-4 w-4" />} label="Members" value={memberWise.length} />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Avg / member" value={memberWise.length ? (totalServings / memberWise.length).toFixed(1) : "0"} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Issue log</CardTitle></CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-y-auto">
              {!rows.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No servings issued in this period.</p>
              ) : rows.map((r) => (
                <button key={r.id} onClick={() => setSelected(r.memberId)} className="w-full rounded-lg border p-3 text-left hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{r.memberName}</p>
                      <p className="text-xs text-muted-foreground">{r.mobile}</p>
                    </div>
                    <Badge variant="secondary">{r.quantity} {r.quantity === 1 ? "serving" : "servings"}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{r.planName}</Badge>
                    {r.reason && <Badge variant="outline" className="text-[10px] italic">"{r.reason}"</Badge>}
                  </div>
                  {r.markedDates.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">For: {r.markedDates.map((d) => formatDate(d)).join(", ")}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(r.issuedAt)}</p>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Member-wise summary</CardTitle></CardHeader>
            <CardContent className="max-h-[560px] space-y-2 overflow-y-auto">
              {!memberWise.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data.</p>
              ) : memberWise.map((m) => (
                <button key={m.memberId} onClick={() => setSelected(m.memberId)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.mobile}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{m.total}</p>
                    <p className="text-[10px] text-muted-foreground">{m.count} {m.count === 1 ? "issue" : "issues"}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      <MemberSheetById memberId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center gap-2">{icon}<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
