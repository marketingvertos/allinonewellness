import { BadgeCheck, CalendarCheck, Clock, Gift, IndianRupee, RefreshCw, Repeat, UserPlus, Award } from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import type { MemberModeFilter } from "@/hooks/useWellness";
import type { DashboardCardKey } from "@/lib/dashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ActivityMembersSheet } from "@/components/wellness/ActivityMembersSheet";

const cards: { key: DashboardCardKey; title: string; description: string; icon: typeof UserPlus }[] = [
  { key: "newGuestsToday", title: "New guests today", description: "First-time visitors who joined today", icon: UserPlus },
  { key: "newGoldCardToday", title: "New Gold Card UMS ₹7,500", description: "New 30-visit memberships started today", icon: BadgeCheck },
  { key: "goldCardRenewalsToday", title: "Gold Card UMS renewals", description: "30-visit ₹7,500 renewals paid today", icon: RefreshCw },
  { key: "newWhiteCardToday", title: "New White Card ₹3,750", description: "New 15-visit memberships started today", icon: Award },
  { key: "whiteCardRenewalsToday", title: "White Card renewals", description: "15-visit ₹3,750 renewals paid today", icon: Repeat },
  { key: "paidTrials3DayToday", title: "3-day paid trials ₹750", description: "Paid trial packs started today", icon: IndianRupee },
  { key: "freeTrials3DayToday", title: "3-day free trials", description: "Free guest trials started today", icon: Gift },
  { key: "renewals3DayToday", title: "3-day renewals ₹750", description: "Repeat 3-day packs paid today", icon: RefreshCw },
  { key: "freeTrials1DayToday", title: "One-day free trials", description: "Single-visit trials started today", icon: Clock },
  { key: "guestDay2VisitsToday", title: "Guest day-2 visits", description: "Day 2 of a trial that started yesterday", icon: CalendarCheck },
];

export function DashboardActivityCards({ mode }: { mode: MemberModeFilter }) {
  const { data, isPending, isError, refetch, isFetching } = useDashboardMetrics(mode);
  const [openKey, setOpenKey] = useState<DashboardCardKey | null>(null);
  const openCard = cards.find((c) => c.key === openKey);
  return (
    <section className="space-y-3" aria-labelledby="dashboard-activity-heading">
      <div>
        <h2 id="dashboard-activity-heading" className="text-base font-semibold">Today&rsquo;s club activity</h2>
        <p className="text-xs text-muted-foreground">
          Guests, memberships, renewals and trials — India time. Tap any card to see who it counts.
        </p>
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
