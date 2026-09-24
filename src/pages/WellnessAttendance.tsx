import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Download, Search, TrendingUp, Trophy, UserCheck, Users, UserX, X } from "lucide-react";
import { MemberModeFilter, useAttendanceRegister, AttendanceRow } from "@/hooks/useWellness";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { cn } from "@/lib/utils";

type ViewMode = "daily" | "weekly" | "monthly" | "custom";

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
];
const MODES: { key: MemberModeFilter; label: string }[] = [
  { key: "physical", label: "Physical" },
  { key: "virtual", label: "Virtual" },
  { key: "all", label: "All" },
];

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (iso: string, n: number) => {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  toUtc(iso).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

function rangeFor(view: ViewMode, customFrom: string, customTo: string) {
  const today = istToday();
  if (view === "daily") return { from: today, to: today };
  if (view === "weekly") {
    const dow = (toUtc(today).getUTCDay() + 6) % 7; // Monday = 0
    const from = addDays(today, -dow);
    return { from, to: addDays(from, 6) };
  }
  if (view === "monthly") {
    const [y, m] = today.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
  }
  return { from: customFrom, to: customTo };
}

function pctVariant(p: number): "default" | "secondary" | "destructive" {
  return p >= 80 ? "default" : p >= 50 ? "secondary" : "destructive";
}

export default function WellnessAttendance() {
  const [view, setView] = useState<ViewMode>("daily");
  const [mode, setMode] = useState<MemberModeFilter>("physical");
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState(addDays(istToday(), -6));
  const [customTo, setCustomTo] = useState(istToday());
  const [selected, setSelected] = useState<string | null>(null);

  const { from, to } = rangeFor(view, customFrom, customTo);
  const { data, isLoading } = useAttendanceRegister(from, to, mode);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.rows ?? [];
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q));
  }, [data, search]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Sr.", "Member", "Mobile", "Mode", "Plan", "Servings Left",
      ...data.dates.map((d) => fmt(d, { day: "2-digit", month: "short" })), "Present", "Absent", "Attendance %"];
    const lines = rows.map((r, i) => [
      i + 1, r.name, r.mobile, r.memberMode, r.planName ?? "", r.remainingServings ?? "",
      ...data.dates.map((d) => (d > data.today ? "-" : r.dayMap[d] ? "P" : "A")),
      r.presentDays, r.absentDays, `${r.percentage}%`,
    ]);
    const csv = [header, ...lines]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${view}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const present = rows.filter((r) => r.dayMap[data?.today ?? ""]);
  const absent = rows.filter((r) => !r.dayMap[data?.today ?? ""]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Attendance Register</h1>
          <p className="text-sm text-muted-foreground">
            {from === to ? fmt(from, { day: "2-digit", month: "short", year: "numeric" })
              : `${fmt(from, { day: "2-digit", month: "short", year: "numeric" })} → ${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Export to Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <Button key={m.key} size="sm" variant={mode === m.key ? "default" : "outline"} onClick={() => setMode(m.key)}>
            {m.label}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Button key={v.key} size="sm" variant={view === v.key ? "secondary" : "ghost"} onClick={() => setView(v.key)}>
            {v.label}
          </Button>
        ))}
      </div>
      {view === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
          <div className="space-y-1">
            <Label htmlFor="att-from">From</Label>
            <Input id="att-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="att-to">To</Label>
            <Input id="att-to" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile icon={<UserCheck className="h-4 w-4 text-primary" />} label="Present today" value={data?.todayPresent ?? 0} />
        <Tile icon={<UserX className="h-4 w-4 text-destructive" />} label="Absent today" value={data?.todayAbsent ?? 0} />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Avg attendance" value={`${data?.avgAttendance ?? 0}%`} />
        <Tile icon={<Trophy className="h-4 w-4" />} label="Best attendee" value={data?.bestAttendee?.name ?? "—"}
          sub={data?.bestAttendee ? `${data.bestAttendee.percentage}%` : undefined} />
        <Tile icon={<Users className="h-4 w-4" />} label="Total members" value={data?.totalMembers ?? 0} />
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : view === "daily" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <MemberList title="Present" tone="present" rows={present} onSelect={setSelected} />
          <MemberList title="Absent" tone="absent" rows={absent} onSelect={setSelected} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 z-10 min-w-[160px] bg-muted p-2 text-left font-medium">Member</th>
                    {data.dates.map((d) => (
                      <th key={d} className={cn("min-w-[40px] p-1 text-center text-xs font-medium",
                        d === data.today && "bg-primary/15 text-primary")}>
                        {view === "weekly" ? (
                          <>
                            <div>{fmt(d, { weekday: "short" })}</div>
                            <div className="text-[10px] text-muted-foreground">{toUtc(d).getUTCDate()}</div>
                          </>
                        ) : toUtc(d).getUTCDate()}
                      </th>
                    ))}
                    <th className="p-2 text-center text-xs font-medium">P</th>
                    <th className="p-2 text-center text-xs font-medium">A</th>
                    <th className="p-2 text-center text-xs font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.memberId} className="border-b">
                      <td className="sticky left-0 z-10 bg-background p-2">
                        <button className="max-w-[180px] truncate text-left font-medium hover:underline" onClick={() => setSelected(r.memberId)}>
                          {r.name}
                        </button>
                        <div className="truncate text-[11px] text-muted-foreground">{r.planName ?? "No active plan"}</div>
                      </td>
                      {data.dates.map((d) => {
                        const future = d > data.today;
                        const on = r.dayMap[d];
                        return (
                          <td key={d} className={cn("p-1 text-center",
                            future ? "bg-muted/40 text-muted-foreground"
                              : on ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive",
                            d === data.today && "ring-1 ring-inset ring-primary")}>
                            {future ? "-" : on ? <Check className="mx-auto h-3.5 w-3.5" /> : <X className="mx-auto h-3.5 w-3.5" />}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-medium">{r.presentDays}</td>
                      <td className="p-2 text-center">{r.absentDays}</td>
                      <td className="p-2 text-center"><Badge variant={pctVariant(r.percentage)}>{r.percentage}%</Badge></td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={data.dates.length + 4} className="p-6 text-center text-muted-foreground">No members match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <MemberSheetById memberId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="truncate text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MemberList({ title, tone, rows, onSelect }: {
  title: string; tone: "present" | "absent"; rows: AttendanceRow[]; onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant={tone === "present" ? "default" : "destructive"}>{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length ? rows.map((r) => (
          <button key={r.memberId} onClick={() => onSelect(r.memberId)}
            className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.planName ?? "No active plan"}</p>
            </div>
            {r.remainingServings !== null && (
              <span className="shrink-0 text-xs text-muted-foreground">{r.remainingServings} left</span>
            )}
          </button>
        )) : <p className="text-sm text-muted-foreground">Nobody here.</p>}
      </CardContent>
    </Card>
  );
}
