import { useState } from "react";
import { Link } from "react-router-dom";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberships, useMemberAttendance, useMyMemberProfile, useWeightHistory, useBodyMeasurements, useAddWeight } from "@/hooks/useWellness";
import { useUpcomingEvent, useMyMonthlyAttendance, currentMonthIst, monthLabel } from "@/hooks/useEvents";
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active membership right now. Please speak to the front desk to start or renew a plan.
            </p>
          )}
        </CardContent>
      </Card>

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
          <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
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
