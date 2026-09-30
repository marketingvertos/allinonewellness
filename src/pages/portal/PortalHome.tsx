import { useState } from "react";
import { Link } from "react-router-dom";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberships, useMemberAttendance, useMyMemberProfile, useWeightHistory, useBodyMeasurements, useAddWeight, useSupervisorStatus } from "@/hooks/useWellness";
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
import { ChevronRight, CreditCard, QrCode, Scale } from "lucide-react";
import { PayOnlineDialog } from "@/components/wellness/PayOnlineDialog";
import { MasterTitleCard } from "@/components/wellness/NetworkPanel";
import { PromotionCards } from "@/components/portal/PromotionCards";
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";

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
  const [payOpen, setPayOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  const startWeight = profile?.initial_weight ?? (history[0]?.weight ?? null);
  const latest = history.length ? history[history.length - 1].weight : profile?.current_weight ?? null;
  const previous = history.length > 1 ? history[history.length - 2].weight : startWeight;
  const latestChange = latest != null && previous != null ? Number(latest) - Number(previous) : null;
  const totalChange = latest != null && startWeight != null ? Number(latest) - Number(startWeight) : null;
  const isGood = (delta: number) => (gaining ? delta > 0 : delta < 0);
  const changeText = (delta: number) =>
    `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;

  const sortedHistory = [...history].sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
  const deltaSeries = sortedHistory.slice(1).map((w, i) => ({
    id: w.id,
    date: w.recorded_date,
    label: formatDate(w.recorded_date).slice(0, 6),
    weight: Number(w.weight),
    delta: Number((Number(w.weight) - Number(sortedHistory[i].weight)).toFixed(1)),
  }));
  const monthPrefix = today.slice(0, 7);
  const elapsedMonthDays = Number(today.slice(8, 10));
  const presentDays = Math.min(monthDays ?? 0, elapsedMonthDays);
  const absentDays = Math.max(0, elapsedMonthDays - presentDays);
  const monthStats = deltaSeries
    .filter((d) => d.date.startsWith(monthPrefix))
    .reduce(
      (s, d) => {
        if (d.delta > 0) { s.upCount++; s.upKg += d.delta; }
        else if (d.delta < 0) { s.downCount++; s.downKg += -d.delta; }
        else s.sameCount++;
        return s;
      },
      { upCount: 0, upKg: 0, downCount: 0, downKg: 0, sameCount: 0 },
    );

  const monthReadings = sortedHistory.filter((w) => w.recorded_date.startsWith(monthPrefix));
  const monthNetChange =
    monthReadings.length >= 2
      ? Number((Number(monthReadings[monthReadings.length - 1].weight) - Number(monthReadings[0].weight)).toFixed(1))
      : null;
  const qualTarget = gaining ? 3 : 5;
  const qualProgress = monthNetChange == null ? 0 : Math.max(0, gaining ? monthNetChange : -monthNetChange);
  const qualQualified = qualProgress >= qualTarget;

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
              <div className="rounded-lg border p-4 text-center">
                <p className="text-4xl font-bold">{active.remaining_servings}</p>
                <p className="text-sm text-muted-foreground">servings left</p>
              </div>
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

      {profile && <PromotionCards memberId={profile.id} memberMode={profile.member_mode} />}

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
          <CardContent className="space-y-5">
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
                <div className="h-52 w-full rounded-md border bg-muted/30 p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deltaSeries.slice(-14)} margin={{ left: 8, right: 8, top: 24, bottom: 18 }}>
                      <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))", fontSize: 12 }}
                        formatter={(v: number, _n, p) => [`${changeText(v)} (now ${p.payload.weight} kg)`, "Change"]}
                        labelFormatter={(_l, p) => (p?.[0] ? formatDate(p[0].payload.date) : "")}
                      />
                      <Bar dataKey="delta" radius={[3, 3, 3, 3]}>
                        <LabelList dataKey="delta" content={(props: { x?: number; y?: number; width?: number; height?: number; value?: number | string; index?: number }) => {
                          const { x, y, width, height, value, index } = props;
                          const delta = Number(value);
                          if (x == null || y == null || width == null || height == null || !Number.isFinite(delta)) return null;
                          const color =
                            delta === 0
                              ? "hsl(var(--muted-foreground))"
                              : isGood(delta)
                                ? "hsl(142 71% 40%)"
                                : "hsl(var(--destructive))";
                           const labelY = delta >= 0
                             ? Math.min(y, y + height) - 5 - ((index ?? 0) % 2) * 10
                             : Math.max(y, y + height) + 13 + ((index ?? 0) % 2) * 10;
                          return (
                             <text x={x + width / 2} y={labelY} fill={color} fontSize={9} fontWeight={600} textAnchor="middle">
                              {delta === 0 ? "0.0" : changeText(delta)}
                            </text>
                          );
                        }} />
                        {deltaSeries.slice(-14).map((d) => (
                          <Cell
                            key={d.id}
                            fill={d.delta === 0 ? "hsl(var(--muted-foreground))" : isGood(d.delta) ? "hsl(142 71% 40%)" : "hsl(var(--destructive))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className={`min-w-0 rounded-md border p-3 ${gaining ? "border-emerald-500/40" : "border-destructive/40"}`}>
                    <p className="text-muted-foreground">Increased this month</p>
                    <p className={`mt-1 text-lg font-semibold leading-tight ${gaining ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {monthStats.upCount} visit{monthStats.upCount === 1 ? "" : "s"}
                    </p>
                    <p className={`font-semibold ${gaining ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>+{monthStats.upKg.toFixed(1)} kg</p>
                  </div>
                  <div className={`min-w-0 rounded-md border p-3 ${gaining ? "border-destructive/40" : "border-emerald-500/40"}`}>
                    <p className="text-muted-foreground">Reduced this month</p>
                    <p className={`mt-1 text-lg font-semibold leading-tight ${gaining ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {monthStats.downCount} visit{monthStats.downCount === 1 ? "" : "s"}
                    </p>
                    <p className={`font-semibold ${gaining ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>−{monthStats.downKg.toFixed(1)} kg</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <span className="text-muted-foreground">Maintained this month</span>
                  <span className="shrink-0 font-semibold">{monthStats.sameCount} reading{monthStats.sameCount === 1 ? "" : "s"}</span>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {monthStats.upCount + monthStats.downCount + monthStats.sameCount === 0
                    ? "No readings this month yet"
                    : <>Net change this month: <span className="font-semibold text-foreground">{changeText(monthStats.upKg - monthStats.downKg)}</span></>}
                </p>
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
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

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-semibold">Attendance this month</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0 rounded-md border p-3">
                  <p className="text-muted-foreground">Present</p>
                  <p className="text-xl font-semibold">{presentDays} <span className="text-sm font-normal">days</span></p>
                </div>
                <div className="min-w-0 rounded-md border p-3">
                  <p className="text-muted-foreground">Absent</p>
                  <p className="text-xl font-semibold">{absentDays} <span className="text-sm font-normal">days</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Consistency reward</span>
                  <span className="shrink-0 font-semibold">{presentDays}/26 days</span>
                </div>
                <Progress value={Math.min(100, (presentDays / 26) * 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {presentDays >= 26
                    ? "You qualify for the consistency reward"
                    : `${26 - presentDays} more day${26 - presentDays === 1 ? "" : "s"} to earn the consistency reward.`}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{gaining ? "Weight gain" : "Weight loss"} qualification</span>
                  <span className="shrink-0 font-semibold">{qualProgress.toFixed(1)}/{qualTarget} kg</span>
                </div>
                <Progress value={Math.min(100, (qualProgress / qualTarget) * 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {monthNetChange == null
                    ? "Not enough readings this month yet."
                    : qualQualified
                      ? `You qualify for the Family Day ${gaining ? "weight gain" : "weight loss"} reward`
                      : `${(qualTarget - qualProgress).toFixed(1)} more kg to earn the Family Day ${gaining ? "weight gain" : "weight loss"} reward.`}
                </p>
              </div>
            </div>

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
                isSupervisor={((profile as { tags?: string[] | null }).tags ?? []).includes("supervisor")}
                status={supervisorStatus}
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
