import { useState } from "react";
import { useActiveTrials, useCreateMembership, useWellnessPlans } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/formatters";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
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

  const membershipPlans = (plans ?? []).filter((p) => p.plan_type === "membership");

  return (
    <div className="space-y-6">
      <PageBanner title="Trials" description="Everyone currently on a trial, and how close they are to converting." />

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
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button
                    className="text-left"
                    onClick={() => t.wellness_members && setSelected(t.wellness_members as WellnessMember)}
                  >
                    <p className="font-medium">{t.wellness_members?.full_name ?? "Member"}</p>
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

      <MemberDetailSheet member={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
