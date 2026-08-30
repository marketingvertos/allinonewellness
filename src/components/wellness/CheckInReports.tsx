import { useMemo, useState } from "react";
import { useCheckInReport } from "@/hooks/useWellness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters";
import { ArrowDownRight, ArrowUpRight, Download, Minus, Trophy } from "lucide-react";

type Range = "daily" | "weekly" | "monthly" | "custom";

function istToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

interface Props {
  onSelectMember?: (memberId: string) => void;
}

export function CheckInReports({ onSelectMember }: Props) {
  const [range, setRange] = useState<Range>("daily");
  const [customFrom, setCustomFrom] = useState(shift(7));
  const [customTo, setCustomTo] = useState(istToday());

  const { from, to } = useMemo(() => {
    if (range === "daily") return { from: istToday(), to: istToday() };
    if (range === "weekly") return { from: shift(6), to: istToday() };
    if (range === "monthly") return { from: shift(29), to: istToday() };
    return { from: customFrom, to: customTo };
  }, [range, customFrom, customTo]);

  const { data, isLoading } = useCheckInReport(from, to);

  const exportCsv = () => {
    const rows = data?.members ?? [];
    const csv = [
      ["Member", "Visits", "Weight (kg)", "Previous (kg)", "Change (kg)"].join(","),
      ...rows.map((r) =>
        [r.name, r.visits, r.weight ?? "", r.previousWeight ?? "", r.delta ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkin-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiles = [
    { label: "Check-ins", value: data?.totals.checkins ?? 0 },
    { label: "Servings used", value: data?.totals.servings ?? 0 },
    { label: "Members", value: data?.totals.uniqueMembers ?? 0 },
    { label: "Approved", value: data?.totals.approved ?? 0 },
    { label: "Rejected", value: data?.totals.rejected ?? 0 },
    { label: "Pending", value: data?.totals.pending ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Attendance report</CardTitle>
              <CardDescription>
                {formatDate(from)} → {formatDate(to)}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.members.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["daily", "weekly", "monthly", "custom"] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                className="capitalize"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          {range === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cr-from">From</Label>
                <Input id="cr-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cr-to">To</Label>
                <Input id="cr-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
                  <p className="text-2xl font-bold">{t.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member summary</CardTitle>
          <CardDescription>Weight recorded in this period and the change against their previous reading.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : data?.members.length ? (
            data.members.map((m) => (
              <button
                key={m.memberId}
                onClick={() => onSelectMember?.(m.memberId)}
                className="flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.visits} visit{m.visits === 1 ? "" : "s"}
                    {m.weight ? ` · ${m.weight} kg` : " · no weight recorded"}
                  </p>
                </div>
                {m.delta === null || m.delta === undefined ? (
                  <Badge variant="outline" className="w-fit gap-1">
                    <Minus className="h-3 w-3" /> No change data
                  </Badge>
                ) : m.delta < 0 ? (
                  <Badge className="w-fit gap-1">
                    <ArrowDownRight className="h-3 w-3" /> {Math.abs(m.delta)} kg lost
                  </Badge>
                ) : m.delta > 0 ? (
                  <Badge variant="secondary" className="w-fit gap-1">
                    <ArrowUpRight className="h-3 w-3" /> {m.delta} kg gained
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-fit">No change</Badge>
                )}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No check-ins recorded in this period.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" /> Milestone watch
          </CardTitle>
          <CardDescription>Members who just unlocked a milestone or are within 1 kg of the next one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.milestones.length ? (
            data.milestones.map((m) => (
              <button
                key={`${m.id}-${m.label}`}
                onClick={() => onSelectMember?.(m.id)}
                className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <span className="font-medium">{m.name}</span>
                <Badge variant={m.achieved ? "default" : "secondary"}>
                  {m.achieved ? `Unlocked ${m.label}` : `${m.away} kg from ${m.label}`}
                </Badge>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nobody is close to a milestone right now.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
