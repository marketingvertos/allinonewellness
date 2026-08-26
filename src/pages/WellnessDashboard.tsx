import { Link } from "react-router-dom";
import { useActiveMemberships, useActiveTrials, useTopReferrers, useWellnessStats } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Users, CalendarCheck, BadgeCheck, AlertTriangle, IndianRupee, QrCode, Sparkles, Trophy } from "lucide-react";
import { BirthdaysCard } from "@/components/wellness/BirthdaysCard";
import { ServingTrendChart } from "@/components/wellness/ServingTrendChart";
import { PendingCheckInsCard } from "@/components/wellness/PendingCheckInsCard";

export default function WellnessDashboard() {
  const { data, isLoading } = useWellnessStats();
  const { data: trials } = useActiveTrials();
  const { data: memberships } = useActiveMemberships();
  const { data: topReferrers } = useTopReferrers(5);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const trialsEndingToday = (trials ?? []).filter((t) => t.end_date <= today).length;
  const converted = (data?.statusCounts?.active_member ?? 0) + (data?.statusCounts?.renewal_due ?? 0);
  const trialPool = converted + (data?.statusCounts?.trial ?? 0);
  const conversionRate = trialPool ? Math.round((converted / trialPool) * 100) : 0;
  const renewals = (memberships ?? []).filter((m) => m.status === "expiring_soon");

  const cards = [
    { title: "Total members", value: data?.totalMembers ?? 0, icon: Users },
    { title: "Check-ins today", value: data?.checkinsToday ?? 0, icon: CalendarCheck },
    { title: "Active memberships", value: data?.activeMemberships ?? 0, icon: BadgeCheck },
    { title: "Active trials", value: trials?.length ?? 0, icon: Sparkles },
    { title: "Trials ending today", value: trialsEndingToday, icon: AlertTriangle },
    { title: "Renewals due", value: data?.renewalsDue ?? 0, icon: AlertTriangle },
    { title: "Trial conversion", value: `${conversionRate}%`, icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <PageBanner title="Wellness overview" description="Members, attendance and serving balances at a glance.">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/wellness/checkin">Open check-in</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link to="/wellness/qr">
              <QrCode className="mr-2 h-4 w-4" /> Check-in QR
            </Link>
          </Button>
        </div>
      </PageBanner>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                <Badge key={status} variant="outline" className="capitalize">
                  {status.replace(/_/g, " ")}: {count}
                </Badge>
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

      <ServingTrendChart />

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
        <BirthdaysCard />
      </div>
    </div>
  );
}
