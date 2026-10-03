import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Download, FileText, RefreshCw, Search, TrendingUp, Trophy, UserCheck, Users, UserX, X } from "lucide-react";
import { MemberModeFilter, useAttendanceRegister, AttendanceRow } from "@/hooks/useWellness";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { cn } from "@/lib/utils";
import { downloadXlsx } from "@/lib/reportExport";
import { downloadBrandedPdf } from "@/lib/reportPdf";

const changeText = (c: number | null) =>
  c == null ? "" : c === 0 ? "No change" : c < 0 ? `${Math.abs(c)} kg loss` : `${c} kg gain`;
const isGood = (r: AttendanceRow) =>
  r.totalChange == null || r.totalChange === 0 ? null : (r.goal === "weight_gain" ? r.totalChange > 0 : r.totalChange < 0);
function ChangeLabel({ r }: { r: AttendanceRow }) {
  if (r.totalChange == null) return <span className="text-muted-foreground">—</span>;
  const good = isGood(r);
  return <span className={cn("font-medium", good === true && "text-primary", good === false && "text-destructive")}>{changeText(r.totalChange)}</span>;
}

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
  const { data, isLoading, isFetching, refetch } = useAttendanceRegister(from, to, mode);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.rows ?? [];
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q) || r.mobile.includes(q));
  }, [data, search]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const buildTable = () => {
    if (!data) return null;
    const head = ["Sr.", "Member", "Mobile", "Mode", "Plan", "Serv. left", "Join kg",
      ...data.dates.map((d) => fmt(d, { day: "2-digit", month: "short" })), "P", "A", "%", "Latest kg", "Change"];
    const body = rows.map((r, i) => [
      i + 1, r.name, r.mobile, r.memberMode, r.planName ?? "", r.remainingServings ?? "", r.initialWeight ?? "",
      ...data.dates.map((d) => {
        if (d > data.today) return "-";
        const w = r.weightByDate[d];
        const mark = r.dayMap[d] === "serving" ? "S" : r.dayMap[d] ? "P" : "A";
        return mark !== "A" && w != null ? `${mark} ${w}` : mark;
      }),
      r.presentDays, r.absentDays, `${r.percentage}%`, r.latestWeight ?? "", changeText(r.totalChange),
    ]);
    return { head, body };
  };
  const fileBase = `AIOW-Attendance-${view}-${from}-to-${to}`;
  const period = from === to ? fmt(from, { day: "2-digit", month: "short", year: "numeric" })
    : `${fmt(from, { day: "2-digit", month: "short", year: "numeric" })} - ${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}`;
  const exportXlsx = () => {
    const t = buildTable();
    if (t) downloadXlsx(`${fileBase}.xlsx`, "Attendance", [t.head, ...t.body]);
  };
  const exportPdf = async () => {
    const t = buildTable();
    if (!t) return;
    setPdfBusy(true);
    try {
      await downloadBrandedPdf({
        filename: `${fileBase}.pdf`, title: "Attendance Register", period, orientation: "landscape",
        sections: [{ head: t.head, body: t.body }],
      });
    } finally { setPdfBusy(false); }
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!rows.length || pdfBusy}>
            <FileText className="mr-2 h-4 w-4" /> {pdfBusy ? "Preparing…" : "PDF"}
          </Button>
        </div>
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
                    <th className="p-2 text-center text-xs font-medium">Latest kg</th>
                    <th className="min-w-[90px] p-2 text-center text-xs font-medium">Change</th>
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
                        const serving = on === "serving";
                        return (
                          <td key={d} title={serving ? "Serving issued (packed)" : undefined} className={cn("p-1 text-center",
                            serving ? "bg-accent text-accent-foreground font-bold text-xs"
                              : future ? "bg-muted/40 text-muted-foreground"
                              : on ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive",
                            d === data.today && "ring-1 ring-inset ring-primary")}>
                            {serving ? "S" : future ? "-" : on ? <Check className="mx-auto h-3.5 w-3.5" /> : <X className="mx-auto h-3.5 w-3.5" />}
                            {on && r.weightByDate[d] != null && <div className="text-[10px] font-normal leading-tight">{r.weightByDate[d]}</div>}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-medium" title={`${r.visitDays} visits + ${r.servingDays} servings`}>
                        {r.presentDays}
                        {r.servingDays > 0 && <div className="text-[10px] font-normal text-muted-foreground">{r.visitDays}+{r.servingDays}S</div>}
                      </td>
                      <td className="p-2 text-center">{r.absentDays}</td>
                      <td className="p-2 text-center"><Badge variant={pctVariant(r.percentage)}>{r.percentage}%</Badge></td>
                      <td className="p-2 text-center">{r.latestWeight ?? "—"}</td>
                      <td className="p-2 text-center text-xs"><ChangeLabel r={r} /></td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={data.dates.length + 6} className="p-6 text-center text-muted-foreground">No members match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 border-t p-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-primary" /> Club visit</span>
              <span><span className="rounded bg-accent px-1 font-bold text-accent-foreground">S</span> Serving issued (packed)</span>
              <span className="flex items-center gap-1"><X className="h-3.5 w-3.5 text-destructive" /> Absent</span>
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
              {tone === "present" && (
                <p className="truncate text-xs">
                  {r.latestWeight != null ? (
                    <>
                      {r.latestWeight} kg
                      {r.latestWeightDate && r.latestWeightDate !== Object.keys(r.dayMap)[0] && (
                        <span className="text-muted-foreground"> (last: {fmt(r.latestWeightDate, { day: "2-digit", month: "short" })})</span>
                      )}
                      {" · "}<ChangeLabel r={r} />
                    </>
                  ) : <span className="text-muted-foreground">No reading</span>}
                </p>
              )}
            </div>
            {tone === "present" && Object.values(r.dayMap).includes("serving") && (
              <Badge variant="outline" className="shrink-0 text-[10px]">Serving issued</Badge>
            )}
            {r.remainingServings !== null && (
              <span className="shrink-0 text-xs text-muted-foreground">{r.remainingServings} left</span>
            )}
          </button>
        )) : <p className="text-sm text-muted-foreground">Nobody here.</p>}
      </CardContent>
    </Card>
  );
}
