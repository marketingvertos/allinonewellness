import { useState } from "react";
import { Link } from "react-router-dom";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberships, useMemberAttendance, useMyMemberProfile, useWeightHistory, useBodyMeasurements, useAddWeight } from "@/hooks/useWellness";
import { useUpcomingEvent, useMyMonthlyAttendance, useWlpAttendance, currentMonthIst, monthLabel } from "@/hooks/useEvents";
import { useAchievementDefinitions, useUnlockedAchievements } from "@/hooks/useAchievements";
import { bmiCategory } from "@/components/wellness/bodyEvalConstants";
import { AchievementsPanel } from "@/components/wellness/AchievementsPanel";
import { PinkCardPanel } from "@/components/wellness/PinkCardPanel";
import { PortalPasswordPrompt } from "@/components/wellness/PortalPasswordPrompt";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatDate, todayIst } from "@/lib/formatters";
import { ChevronRight, QrCode, Scale } from "lucide-react";
import { MasterTitleCard } from "@/components/wellness/NetworkPanel";

export default function PortalHome() {
  const { data: identity } = useMemberIdentity();
  const { user } = useAuth();
  const { data: profile } = useMyMemberProfile();
  const { data: memberships } = useMemberships(identity?.memberId ?? undefined);
  const { data: attendance } = useMemberAttendance(identity?.memberId ?? undefined);
  const { data: weights } = useWeightHistory(identity?.memberId ?? undefined);
  const { data: evaluations } = useBodyMeasurements(identity?.memberId ?? undefined);
  const latestEvaluation = evaluations?.length ? evaluations[evaluations.length - 1] : null;
  const addWeight = useAddWeight();

  const month = currentMonthIst();
  const { data: familyDay } = useUpcomingEvent("family_day");
  const { data: monthDays } = useMyMonthlyAttendance(identity?.memberId ?? undefined, month);
  const { data: unlocked } = useUnlockedAchievements(identity?.memberId ?? undefined);
  const { data: definitions } = useAchievementDefinitions();
  const { data: wlpRows } = useWlpAttendance(month);
  const isCoach = (profile?.tags ?? []).includes("coach");
  const wlpSessions = (wlpRows ?? []).filter((r) => r.member_id === identity?.memberId).length;
  const myMilestones = (unlocked ?? [])
    .map((u) => (definitions ?? []).find((d) => d.id === u.achievement_id))
    .filter((d): d is NonNullable<typeof d> => !!d && d.category !== "referral")
    .sort((a, b) => b.sort_order - a.sort_order);
  const topMilestone = myMilestones[0] ?? null;


  const active = (memberships ?? []).find((m) => m.status === "active" || m.status === "expiring_soon");
  const today = todayIst();
  const checkedInToday = (attendance ?? []).some((a) => a.visit_date === today);

  const history = weights ?? [];
  const recordedToday = history.some((w) => w.recorded_date === today);
  const gaining = profile?.goal === "weight_gain";
  const [weighOpen, setWeighOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  const startWeight = profile?.initial_weight ?? (history[0]?.weight ?? null);
  const latest = history.length ? history[history.length - 1].weight : profile?.current_weight ?? null;
  const previous = history.length > 1 ? history[history.length - 2].weight : startWeight;
  const latestChange = latest != null && previous != null ? Number(latest) - Number(previous) : null;
  const totalChange = latest != null && startWeight != null ? Number(latest) - Number(startWeight) : null;
  const isGood = (delta: number) => (gaining ? delta > 0 : delta < 0);
  const changeText = (delta: number) =>
    `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;

  const maxW = history.length ? Math.max(...history.map((w) => Number(w.weight))) : 0;
  const minW = history.length ? Math.min(...history.map((w) => Number(w.weight))) : 0;
  const span = Math.max(maxW - minW, 1);

  const saveWeight = async () => {
    const value = Number(newWeight);
    if (!identity?.memberId || !user || !value) return;
    await addWeight.mutateAsync({
      member_id: identity.memberId,
      weight: value,
      recorded_date: today,
      recorded_by: user.id,
    });
    setNewWeight("");
    setWeighOpen(false);
  };

  return (
    <div className="space-y-4">
      <PortalPasswordPrompt />
      <InstallAppPrompt />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {active ? (
            <>
              <div className="flex items-center justify-between">
                <p className="font-medium">{active.wellness_plans?.name ?? "Membership"}</p>
                <Badge variant={active.status === "expiring_soon" ? "destructive" : "secondary"}>
                  {active.status === "expiring_soon" ? "Renewal due" : "Active"}
                </Badge>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-3xl font-bold">{active.remaining_servings}</span>
                  <span className="text-muted-foreground">of {active.total_servings} servings left</span>
                </div>
                <Progress value={(active.remaining_servings / Math.max(active.total_servings, 1)) * 100} />
              </div>
              <p className="text-sm text-muted-foreground">Valid until {formatDate(active.end_date)}</p>
              <Button variant="outline" className="w-full" onClick={() => setPayOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Renew online
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No active membership right now. Pay online to start a plan, or speak to the front desk.
              </p>
              <Button className="w-full" onClick={() => setPayOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Pay online
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {profile && (
        <PayOnlineDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          memberName={profile.full_name}
          pinkBalance={profile.pink_card_balance ?? 0}
          defaultPlanId={active?.plan_id ?? null}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {checkedInToday ? "You have already checked in today." : "You have not checked in yet today."}
          </p>
          <Button asChild className="w-full" disabled={checkedInToday}>
            <Link to="/portal/checkin">
              <QrCode className="mr-2 h-4 w-4" /> Scan centre QR to check in
            </Link>
          </Button>
        </CardContent>
      </Card>

      {profile?.current_weight && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Start</p>
                <p className="font-semibold">{profile.initial_weight ?? "—"} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">Now</p>
                <p className="font-semibold">{profile.current_weight} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">Target</p>
                <p className="font-semibold">{profile.target_weight ?? "—"} kg</p>
              </div>
            </div>

            {history.length > 1 && (
              <div>
                <div className="flex h-28 items-end gap-1 rounded-md border bg-muted/30 p-2">
                  {history.slice(-14).map((w, i, arr) => {
                    const prev = i > 0 ? Number(arr[i - 1].weight) : Number(w.weight);
                    const delta = Number(w.weight) - prev;
                    const good = delta === 0 ? null : isGood(delta);
                    const height = 8 + ((Number(w.weight) - minW) / span) * 80;
                    return (
                      <div key={w.id} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            good === null
                              ? "bg-muted-foreground"
                              : good
                                ? "bg-emerald-500"
                                : "bg-destructive"
                          }`}
                          style={{ marginBottom: `${height}px` }}
                          title={`${formatDate(w.recorded_date)} — ${w.weight} kg`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Latest change:{" "}
                    {latestChange == null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          latestChange === 0
                            ? ""
                            : isGood(latestChange)
                              ? "font-semibold text-emerald-600 dark:text-emerald-400"
                              : "font-semibold text-destructive"
                        }
                      >
                        {changeText(latestChange)}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    Total change:{" "}
                    {totalChange == null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          totalChange === 0
                            ? ""
                            : isGood(totalChange)
                              ? "font-semibold text-emerald-600 dark:text-emerald-400"
                              : "font-semibold text-destructive"
                        }
                      >
                        {changeText(totalChange)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setWeighOpen(true)}
              disabled={recordedToday}
            >
              <Scale className="mr-2 h-4 w-4" />
              {recordedToday ? "Today's weight is recorded" : "Record today's weight"}
            </Button>
          </CardContent>
        </Card>
      )}

      <ResponsiveDialog
        open={weighOpen}
        onOpenChange={setWeighOpen}
        title="Record today's weight"
        description={`Saved against ${formatDate(today)}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setWeighOpen(false)}>Cancel</Button>
            <Button onClick={saveWeight} disabled={!newWeight || addWeight.isPending}>Save</Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="pw-weight">Weight (kg)</Label>
          <Input
            id="pw-weight"
            inputMode="decimal"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="e.g. 74.5"
          />
        </div>
      </ResponsiveDialog>

      {familyDay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Family Day — {monthLabel(month)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{formatDate(familyDay.event_date)}</p>
            {familyDay.description && (
              <p className="text-muted-foreground">{familyDay.description}</p>
            )}
            <p className="text-muted-foreground">
              You have attended <span className="font-semibold text-foreground">{monthDays ?? 0}</span> days
              this month.
            </p>
            {(monthDays ?? 0) >= 26 ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                You qualify for the consistency reward
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">
                {26 - (monthDays ?? 0)} more days to earn the consistency reward.
              </p>
            )}
            {topMilestone && (
              <p className="text-muted-foreground">
                Milestone achieved: <span className="font-semibold text-foreground">{topMilestone.icon} {topMilestone.name}</span>
              </p>
            )}
            {isCoach && (
              <p className="text-muted-foreground">
                WLP sessions attended this month:{" "}
                <span className="font-semibold text-foreground">{wlpSessions}</span>
                {wlpSessions >= 4 ? " — King/Queen eligible" : ` (${4 - wlpSessions} more for King/Queen)`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Awards are handed out at the Family Day ceremony.
            </p>
          </CardContent>
        </Card>
      )}


      {profile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(profile.network_total ?? 0) > 0 ? (
              <MasterTitleCard
                frontline={profile.frontline_count ?? 0}
                cluster={profile.cluster_count ?? 0}
                total={profile.network_total ?? 0}
                compact
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Start building your community by referring friends and family to the centre. Reach 10
                  members to earn the Master 10 title!
                </p>
                <p className="text-xs text-muted-foreground">0 of 10 for Master 10</p>
                <Progress value={0} className="h-2 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-400" />
              </div>
            )}
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/portal/network">
                View my network <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {latestEvaluation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Body evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Last recorded: {formatDate(latestEvaluation.recorded_date)}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {latestEvaluation.bmi != null && (
                <div>
                  <p className="text-muted-foreground">BMI</p>
                  <p className="font-semibold">{latestEvaluation.bmi}</p>
                  <p className="text-xs text-muted-foreground">{bmiCategory(Number(latestEvaluation.bmi))}</p>
                </div>
              )}
              {latestEvaluation.body_fat_percentage != null && (
                <div>
                  <p className="text-muted-foreground">Body fat</p>
                  <p className="font-semibold">{latestEvaluation.body_fat_percentage}%</p>
                </div>
              )}
              {latestEvaluation.muscle_mass != null && (
                <div>
                  <p className="text-muted-foreground">Muscle mass</p>
                  <p className="font-semibold">{latestEvaluation.muscle_mass} kg</p>
                </div>
              )}
              {latestEvaluation.visceral_fat != null && (
                <div>
                  <p className="text-muted-foreground">Visceral fat</p>
                  <p className="font-semibold">{latestEvaluation.visceral_fat}</p>
                </div>
              )}
              {latestEvaluation.bmr != null && (
                <div>
                  <p className="text-muted-foreground">BMR</p>
                  <p className="font-semibold">{latestEvaluation.bmr} kcal/day</p>
                </div>
              )}
              {latestEvaluation.body_age != null && (
                <div>
                  <p className="text-muted-foreground">Body age</p>
                  <p className="font-semibold">{latestEvaluation.body_age} yrs</p>
                </div>
              )}
            </div>
            {latestEvaluation.remark && (
              <p className="text-xs italic text-muted-foreground">{latestEvaluation.remark}</p>
            )}
          </CardContent>
        </Card>
      )}

      {profile && (
        <PinkCardPanel memberId={profile.id} balance={profile.pink_card_balance} readOnly />
      )}

      {profile && <AchievementsPanel member={profile} weights={weights ?? []} compact />}
    </div>
  );
}
