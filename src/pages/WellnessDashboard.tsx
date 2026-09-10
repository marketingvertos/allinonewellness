import { Link, useSearchParams } from "react-router-dom";
import {
  MemberModeFilter,
  periodRange,
  useActiveMemberships,
  useActiveTrials,
  useSalesAnalytics,
  useTopReferrers,
  useWellnessStats,
} from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Users, CalendarCheck, BadgeCheck, AlertTriangle, IndianRupee, QrCode, Sparkles, Trophy } from "lucide-react";
import { BirthdaysCard } from "@/components/wellness/BirthdaysCard";
import { ServingTrendChart } from "@/components/wellness/ServingTrendChart";
import { PendingCheckInsCard } from "@/components/wellness/PendingCheckInsCard";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
] as const;

function SalesTile({ label, period, mode }: { label: string; period: (typeof PERIODS)[number]["key"]; mode: MemberModeFilter }) {
  const { data } = useSalesAnalytics(periodRange(period), mode);
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{formatCurrency(data?.revenue ?? 0)}</p>
      <p className="text-xs text-muted-foreground">
        {data?.memberships ?? 0} sold · {data?.servings ?? 0} servings
      </p>
    </div>
  );
}

export default function WellnessDashboard() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get("mode") as MemberModeFilter) || "all";
  const setMode = (next: string) => {
    if (!next) return;
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("mode");
    else p.set("mode", next);
    setParams(p, { replace: true });
  };

  const { data, isLoading } = useWellnessStats(mode);
  const { data: trials } = useActiveTrials(mode);
  const { data: memberships } = useActiveMemberships(mode);
  const { data: topReferrers } = useTopReferrers(5, mode);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const trialsEndingToday = (trials ?? []).filter((t) => t.end_date <= today).length;
  const converted = (data?.statusCounts?.active_member ?? 0) + (data?.statusCounts?.renewal_due ?? 0);
  const trialPool = converted + (data?.statusCounts?.trial ?? 0);
  const conversionRate = trialPool ? Math.round((converted / trialPool) * 100) : 0;
  const renewals = (memberships ?? []).filter((m) => m.status === "expiring_soon");

  const modeQuery = mode === "all" ? "" : `&mode=${mode}`;
  const cards = [
    { title: "Total members", value: data?.totalMembers ?? 0, icon: Users, to: `/members?status=all${modeQuery}` },
    { title: "Check-ins today", value: data?.checkinsToday ?? 0, icon: CalendarCheck, to: "/checkin?tab=today" },
    { title: "Active memberships", value: data?.activeMemberships ?? 0, icon: BadgeCheck, to: `/members?status=active_member${modeQuery}` },
    { title: "Active trials", value: trials?.length ?? 0, icon: Sparkles, to: "/trials" },
    { title: "Trials ending today", value: trialsEndingToday, icon: AlertTriangle, to: "/trials" },
    { title: "Renewals due", value: data?.renewalsDue ?? 0, icon: AlertTriangle, to: `/members?status=renewal_due${modeQuery}` },
    { title: "Trial conversion", value: `${conversionRate}%`, icon: Trophy, to: undefined as string | undefined },
  ];

  return (
    <div className="space-y-6">
      <PageBanner title="Wellness overview" description="Members, attendance and serving balances at a glance.">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/checkin">Open check-in</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link to="/qr">
              <QrCode className="mr-2 h-4 w-4" /> Check-in QR
            </Link>
          </Button>
        </div>
      </PageBanner>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={setMode}
        className="w-full justify-start gap-2 sm:w-auto"
      >
        <ToggleGroupItem value="physical" className="flex-1 sm:flex-none">Physical</ToggleGroupItem>
        <ToggleGroupItem value="virtual" className="flex-1 sm:flex-none">Virtual</ToggleGroupItem>
        <ToggleGroupItem value="all" className="flex-1 sm:flex-none">All</ToggleGroupItem>
      </ToggleGroup>

      <PendingCheckInsCard memberMode={mode} />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const body = (
              <Card className={c.to ? "transition-colors hover:border-primary hover:bg-accent/40" : undefined}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{c.value}</p>
                </CardContent>
              </Card>
            );
            return c.to ? (
              <Link key={c.title} to={c.to} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {body}
              </Link>
            ) : (
              <div key={c.title}>{body}</div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales &amp; servings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERIODS.map((p) => (
            <SalesTile key={p.key} label={p.label} period={p.key} mode={mode} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Revenue (last 30 days)</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(data?.revenueLast30Days ?? 0)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data?.statusCounts ?? {}).map(([status, count]) => (
                <Link key={status} to={`/members?status=${status}${modeQuery}`}>
                  <Badge variant="outline" className="capitalize transition-colors hover:bg-accent hover:underline">
                    {status.replace(/_/g, " ")}: {count}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low serving balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.lowBalance?.length ? (
              data.lowBalance.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.wellness_members?.full_name}</p>
                    <p className="text-xs text-muted-foreground">Ends {formatDate(m.end_date)}</p>
                  </div>
                  <Badge variant={m.remaining_servings <= 1 ? "destructive" : "secondary"}>
                    {m.remaining_servings} left
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Everyone has a healthy balance.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ServingTrendChart memberMode={mode} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renewals due</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {renewals.length ? (
              renewals.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.wellness_members?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.wellness_plans?.name} · ends {formatDate(m.end_date)}
                    </p>
                  </div>
                  <Badge variant="secondary">{m.remaining_servings} servings left</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No memberships expiring in the next few days.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top referrers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topReferrers?.length ? (
              topReferrers.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">
                    {i + 1}. {r.full_name}
                  </span>
                  <Badge variant="outline">{r.count} helped</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No referrals recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BirthdaysCard memberMode={mode} />
      </div>
    </div>
  );
}
