import { BadgeCheck, CalendarDays, Gift, IndianRupee, RefreshCw, UserPlus, Users } from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import type { MemberModeFilter } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ActivityMembersSheet } from "@/components/wellness/ActivityMembersSheet";

const cards = [
  { key: "newMembersToday", title: "New members today", description: "First membership starts today", icon: UserPlus },
  { key: "newMembersThisMonth", title: "New members this month", description: "First membership starts this month", icon: Users },
  { key: "newUms30ThisMonth", title: "New 30-day UMS", description: "New members this month on UMS 30", icon: BadgeCheck },
  { key: "umsRenewalsToday", title: "UMS renewals today", description: "Members with a paid UMS renewal today", icon: RefreshCw },
  { key: "dailyRenewalsToday", title: "Daily renewals today", description: "Members with a paid one-day renewal today", icon: CalendarDays },
  { key: "paidTrials3Day", title: "3-day paid trials", description: "Active today on a paid trial plan", icon: IndianRupee },
  { key: "freeTrials3Day", title: "3-day free trials", description: "Active today, including free guest trials", icon: Gift },
  { key: "newGuestsToday", title: "New guests today", description: "Guest joining date is today", icon: UserPlus },
] as const;

export function DashboardActivityCards({ mode }: { mode: MemberModeFilter }) {
  const { data, isPending, isError, refetch, isFetching } = useDashboardMetrics(mode);
  const [openKey, setOpenKey] = useState<(typeof cards)[number]["key"] | null>(null);
  const openCard = cards.find((c) => c.key === openKey);
  return (
    <section className="space-y-3" aria-labelledby="dashboard-activity-heading">
      <div>
        <h2 id="dashboard-activity-heading" className="text-base font-semibold">New members, renewals &amp; trials</h2>
        <p className="text-xs text-muted-foreground">Today and this month use India time. Each card counts members once.</p>
      </div>
      {isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm">Could not load the latest member and renewal counts.</p>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={isPending}>
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setOpenKey(card.key)}
              className="h-full rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/30">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                {isPending ? (
                  <Skeleton className="h-9 w-16" aria-label="Loading count" />
                ) : (
                  <p className="text-3xl font-bold">{data?.[card.key] ?? 0}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
            </button>
          ))}
        </div>
      )}
      {openCard && data && (
        <ActivityMembersSheet
          open
          onOpenChange={(o) => !o && setOpenKey(null)}
          title={openCard.title}
          description={openCard.description}
          items={data.lists[openCard.key] ?? []}
          memberById={data.memberById}
          planById={data.planById}
        />
      )}
    </section>
  );
}
