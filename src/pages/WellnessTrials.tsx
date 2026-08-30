import { useState } from "react";
import { useActiveTrials, useCreateMembership, useTrialCandidates, useWellnessPlans } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/formatters";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
import { StartTrialDialog } from "@/components/wellness/StartTrialDialog";
import { GuestTrialDialog } from "@/components/wellness/GuestTrialDialog";
import { Search, UserPlus } from "lucide-react";
import type { WellnessMember } from "@/hooks/useWellness";

function daysLeft(endDate: string) {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00");
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export default function WellnessTrials() {
  const { data: trials, isLoading } = useActiveTrials();
  const { data: plans } = useWellnessPlans();
  const createMembership = useCreateMembership();
  const [planByTrial, setPlanByTrial] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<WellnessMember | null>(null);

  const [query, setQuery] = useState("");
  const { data: candidates, isFetching } = useTrialCandidates(query);
  const [trialFor, setTrialFor] = useState<WellnessMember | null>(null);
  const [guestOpen, setGuestOpen] = useState(false);

  const membershipPlans = (plans ?? []).filter((p) => p.plan_type === "membership");
  const searching = query.trim().length > 1;
  const noMatches = searching && !isFetching && (candidates ?? []).length === 0;

  return (
    <div className="space-y-6">
      <PageBanner title="Trials" description="Everyone currently on a trial, and how close they are to converting." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a trial</CardTitle>
          <CardDescription>
            Search by name or mobile number. People already on a membership or trial can&apos;t start another one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Type a name or mobile number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => setGuestOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Guest trial
            </Button>
          </div>

          {searching &&
            (candidates ?? []).map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.mobile_number}</p>
                </div>
                {c.blockedReason ? (
                  <Badge variant="secondary" className="w-fit">
                    {c.blockedReason}
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => setTrialFor(c)}>
                    Start trial
                  </Button>
                )}
              </div>
            ))}

          {noMatches && (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No one found for “{query}”. You can start a 3-day free{" "}
              <button className="font-medium text-primary underline" onClick={() => setGuestOpen(true)}>
                guest trial
              </button>{" "}
              with just a name, mobile number and start date.
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : trials?.length ? (
        <div className="space-y-2">
          {trials.map((t) => {
            const left = daysLeft(t.end_date);
            const planId = planByTrial[t.id] ?? "";
            const isGuest = !!t.wellness_members?.is_guest;
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="text-left"
                    onClick={() => t.wellness_members && setSelected(t.wellness_members as WellnessMember)}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      {t.wellness_members?.full_name ?? "Member"}
                      {isGuest && <Badge variant="outline">Guest</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.wellness_members?.mobile_number} · {formatDate(t.start_date)} → {formatDate(t.end_date)}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={left <= 0 ? "destructive" : left <= 1 ? "secondary" : "outline"}>
                      {left <= 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}
                    </Badge>
                    <Select
                      value={planId}
                      onValueChange={(v) => setPlanByTrial((p) => ({ ...p, [t.id]: v }))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Convert to plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {membershipPlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!planId || createMembership.isPending}
                      onClick={() =>
                        createMembership.mutate({ memberId: t.member_id, planId, trialId: t.id })
                      }
                    >
                      Convert
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">No active trials right now.</p>
      )}

      {trialFor && (
        <StartTrialDialog
          member={trialFor}
          open={!!trialFor}
          onOpenChange={(o) => !o && setTrialFor(null)}
        />
      )}
      <GuestTrialDialog open={guestOpen} onOpenChange={setGuestOpen} defaultName={query} />

      <MemberDetailSheet member={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
