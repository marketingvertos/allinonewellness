import { Link } from "react-router-dom";
import { useWellnessStats } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Users, CalendarCheck, BadgeCheck, AlertTriangle, IndianRupee } from "lucide-react";

export default function WellnessDashboard() {
  const { data, isLoading } = useWellnessStats();

  const cards = [
    { title: "Total members", value: data?.totalMembers ?? 0, icon: Users },
    { title: "Check-ins today", value: data?.checkinsToday ?? 0, icon: CalendarCheck },
    { title: "Active memberships", value: data?.activeMemberships ?? 0, icon: BadgeCheck },
    { title: "Renewals due", value: data?.renewalsDue ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <PageBanner title="Wellness overview" description="Members, attendance and serving balances at a glance.">
        <Button asChild className="w-full sm:w-auto">
          <Link to="/wellness/checkin">Open check-in</Link>
        </Button>
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
                <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
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
    </div>
  );
}
