import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WellnessMember, WellnessMembership, BodyMeasurement } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowDownRight, ArrowUpRight, Cake, Heart, Minus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BodyEvalPrintCard } from "./BodyEvalPrintCard";
import { BodyEvalParam, bmiCategory, getRange } from "./bodyEvalConstants";

interface Props {
  member: WellnessMember;
  membership?: WellnessMembership | null;
  weights: { recorded_date: string; weight: number }[];
  attendance: { visit_date: string }[];
  measurements: BodyMeasurement[];
}

// Indian BMI categories live in bodyEvalConstants.

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}

export function MemberDashboard({ member, membership, weights, attendance, measurements }: Props) {
  const isMobile = useIsMobile();
  const start = member.initial_weight ?? weights[0]?.weight ?? null;
  const current = weights.length ? weights[weights.length - 1].weight : member.current_weight;
  const target = member.target_weight;
  const change = start != null && current != null ? Number((current - start).toFixed(1)) : null;
  const lastChange =
    weights.length > 1 ? Number((weights[weights.length - 1].weight - weights[weights.length - 2].weight).toFixed(1)) : null;

  const bmi = current && member.height ? Number((current / Math.pow(member.height / 100, 2)).toFixed(1)) : null;

  const goalPct =
    start != null && current != null && target != null && start !== target
      ? Math.max(0, Math.min(100, Math.round(((start - current) / (start - target)) * 100)))
      : null;

  const visitsThisMonth = useMemo(() => {
    const prefix = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
    return attendance.filter((a) => a.visit_date?.startsWith(prefix)).length;
  }, [attendance]);

  const daysLeft = membership
    ? Math.max(0, Math.round((new Date(`${membership.end_date}T00:00:00`).getTime() - Date.now()) / 86400000))
    : null;

  const weightSeries = weights.map((w) => ({
    date: formatDate(w.recorded_date).slice(0, 6),
    weight: Number(w.weight),
  }));

  const weeklyVisits = useMemo(() => {
    const buckets: { label: string; visits: number }[] = [];
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const end = new Date(today);
      end.setDate(end.getDate() - i * 7);
      const startD = new Date(end);
      startD.setDate(startD.getDate() - 6);
      const visits = attendance.filter((a) => {
        const d = new Date(`${a.visit_date}T00:00:00`);
        return d >= startD && d <= end;
      }).length;
      buckets.push({
        label: `${startD.getDate()}/${startD.getMonth() + 1}`,
        visits,
      });
    }
    return buckets;
  }, [attendance]);

  const first = measurements[0];
  const latest = measurements[measurements.length - 1];
  const compositionData = latest
    ? (["waist", "hip", "chest", "body_fat_percentage"] as const)
        .filter((k) => latest[k] != null)
        .map((k) => ({
          metric: k === "body_fat_percentage" ? "Body fat %" : k[0].toUpperCase() + k.slice(1),
          first: Number(first?.[k] ?? latest[k]),
          latest: Number(latest[k]),
        }))
    : [];

  const memberAge = age(member.date_of_birth);
  const anniversaryYears = age(member.anniversary_date ?? null);

  const tiles = [
    { label: "Current weight", value: current != null ? `${current} kg` : "—", sub: start != null ? `Start ${start} kg` : "" },
    {
      label: "Total change",
      value: change != null ? `${change > 0 ? "+" : ""}${change} kg` : "—",
      sub: change != null && start ? `${((change / start) * 100).toFixed(1)}%` : "",
      trend: change,
    },
    { label: "BMI", value: bmi != null ? `${bmi}` : "—", sub: bmi != null ? bmiCategory(bmi) : "Add height" },
    {
      label: "Servings left",
      value: membership ? `${membership.remaining_servings}` : "—",
      sub: membership ? `of ${membership.total_servings}` : "No active plan",
    },
    { label: "Visits this month", value: `${visitsThisMonth}`, sub: `${attendance.length} total` },
    { label: "Days left on plan", value: daysLeft != null ? `${daysLeft}` : "—", sub: membership ? `Ends ${formatDate(membership.end_date)}` : "" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {member.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{member.full_name}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {[memberAge ? `${memberAge} yrs` : null, member.gender, member.height ? `${member.height} cm` : null,
                `Joined ${formatDate(member.joining_date)}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {(member.date_of_birth || member.goal || member.marital_status) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {member.date_of_birth && (
              <Badge variant="outline" className="gap-1">
                <Cake className="h-3 w-3" /> {formatDate(member.date_of_birth)}
              </Badge>
            )}
            {member.marital_status && (
              <Badge variant="outline" className="gap-1 capitalize">
                <Heart className="h-3 w-3" />
                {member.marital_status.replace(/_/g, " ")}
                {member.marital_status === "married" && member.anniversary_date
                  ? ` · ${formatDate(member.anniversary_date)}${anniversaryYears != null ? ` (${anniversaryYears} yrs)` : ""}`
                  : ""}
              </Badge>
            )}
            {member.goal && <Badge variant="secondary" className="capitalize">{member.goal.replace(/_/g, " ")}</Badge>}
          </div>
        )}
      </div>


      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
            <p className="mt-1 flex items-center gap-1 text-xl font-bold sm:text-2xl">
              {t.value}
              {"trend" in t && t.trend != null && t.trend !== 0 && (
                t.trend < 0 ? (
                  <ArrowDownRight className="h-4 w-4 text-primary" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-destructive" />
                )
              )}
              {"trend" in t && t.trend === 0 && <Minus className="h-4 w-4 text-muted-foreground" />}
            </p>
            {t.sub && <p className="text-xs text-muted-foreground">{t.sub}</p>}
          </div>
        ))}
      </div>

      {goalPct != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Goal progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={goalPct} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Start {start} kg</span>
              <span className="font-medium text-foreground">{goalPct}% achieved</span>
              <span>Target {target} kg</span>
            </div>
            {lastChange != null && (
              <p className="text-xs text-muted-foreground">
                Since last reading: {lastChange > 0 ? "+" : ""}{lastChange} kg
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {weightSeries.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Weight trend</CardTitle>
          </CardHeader>
          <CardContent className="h-44 px-2 sm:h-52 sm:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightSeries} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" fontSize={10} minTickGap={isMobile ? 24 : 8} interval="preserveStartEnd" tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} width={isMobile ? 30 : 40} fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                />
                {target != null && <ReferenceLine y={target} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
                <Area type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#wgrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attendance (last 8 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="h-44 px-2 sm:h-48 sm:px-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVisits} margin={{ left: -24, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" fontSize={10} minTickGap={isMobile ? 16 : 4} interval="preserveStartEnd" tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} width={isMobile ? 24 : 34} fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="visits" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Body composition</CardTitle>
          </CardHeader>
          <CardContent className="h-44 px-2 sm:h-48 sm:px-6">
            {compositionData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compositionData} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="metric" width={isMobile ? 62 : 80} fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="first" name="First" radius={[0, 4, 4, 0]} fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="latest" name="Latest" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="pt-12 text-center text-sm text-muted-foreground">
                No measurements recorded yet. Add them from the Progress tab.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
