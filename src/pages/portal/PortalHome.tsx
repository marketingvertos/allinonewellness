import { Link } from "react-router-dom";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useMemberships, useMemberAttendance, useMyMemberProfile, useWeightHistory, useBodyMeasurements } from "@/hooks/useWellness";
import { bmiCategory } from "@/components/wellness/bodyEvalConstants";
import { AchievementsPanel } from "@/components/wellness/AchievementsPanel";
import { PinkCardPanel } from "@/components/wellness/PinkCardPanel";
import { PortalPasswordPrompt } from "@/components/wellness/PortalPasswordPrompt";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/formatters";
import { QrCode } from "lucide-react";

export default function PortalHome() {
  const { data: identity } = useMemberIdentity();
  const { data: profile } = useMyMemberProfile();
  const { data: memberships } = useMemberships(identity?.memberId ?? undefined);
  const { data: attendance } = useMemberAttendance(identity?.memberId ?? undefined);
  const { data: weights } = useWeightHistory(identity?.memberId ?? undefined);
  const { data: evaluations } = useBodyMeasurements(identity?.memberId ?? undefined);
  const latestEvaluation = evaluations?.length ? evaluations[evaluations.length - 1] : null;

  const active = (memberships ?? []).find((m) => m.status === "active" || m.status === "expiring_soon");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const checkedInToday = (attendance ?? []).some((a) => a.visit_date === today);

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
