import { useMemo } from "react";
import {
  AchievementCategory,
  buildLadder,
  isActiveMemberStatus,
  istMonthKey,
  useAchievementDefinitions,
  useCoachMonthlyActivity,
  useMemberReferrals,
  useUnlockedAchievements,
} from "@/hooks/useAchievements";
import { MilestoneBadge, tierForIndex } from "./MilestoneBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/formatters";
import { AlertTriangle, CalendarCheck, Check, Trophy, Users, X } from "lucide-react";

interface MemberLike {
  id: string;
  goal: string | null;
  initial_weight: number | null;
  current_weight: number | null;
  target_weight?: number | null;
  status?: string | null;
}

const MONTH_LABEL = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

interface Props {
  member: MemberLike;
  weights?: { recorded_date: string; weight: number }[];
  compact?: boolean;
}

export function AchievementsPanel({ member, weights = [], compact = false }: Props) {
  const { data: defs } = useAchievementDefinitions(true);
  const { data: unlocked } = useUnlockedAchievements(member.id);
  const { data: referrals } = useMemberReferrals(member.id);
  const { data: activity } = useCoachMonthlyActivity(member.id);

  const unlockedIds = useMemo(
    () => new Set((unlocked ?? []).map((u) => u.achievement_id)),
    [unlocked],
  );
  const unlockedAt = useMemo(
    () => new Map((unlocked ?? []).map((u) => [u.achievement_id, u.unlocked_at])),
    [unlocked],
  );

  const activeReferralCount = (referrals ?? []).filter((r) => isActiveMemberStatus(r.status)).length;
  const totalReferralCount = (referrals ?? []).filter((r) => r.status !== "inactive").length;
  const referralCount = activeReferralCount;
  const ownMembershipActive = member.status == null || isActiveMemberStatus(member.status);

  const thisMonth = istMonthKey();
  const currentActivity = (activity ?? []).find((a) => a.month === thisMonth);
  const recentActivity = (activity ?? []).filter((a) => a.month !== thisMonth).slice(0, 3);

  const start = member.initial_weight ?? weights[0]?.weight ?? null;
  const current = weights.length ? weights[weights.length - 1].weight : member.current_weight;

  const healthCategory: AchievementCategory = member.goal === "weight_gain" ? "weight_gain" : "weight_loss";
  const delta =
    start != null && current != null
      ? Number((healthCategory === "weight_gain" ? current - start : start - current).toFixed(1))
      : 0;

  // How much the member set out to lose/gain — drives which milestones are worth showing.
  const goalDelta =
    start != null && member.target_weight != null
      ? Number(
          Math.abs(healthCategory === "weight_gain" ? member.target_weight - start : start - member.target_weight)
            .toFixed(1),
        )
      : null;

  const community = buildLadder("referral", defs ?? [], unlockedIds, referralCount);
  const health = buildLadder(healthCategory, defs ?? [], unlockedIds, Math.max(0, delta), goalDelta);

  const showHealth =
    !!member.goal && ["weight_loss", "fat_loss", "weight_gain", "body_transformation"].includes(member.goal);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {showHealth && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              {healthCategory === "weight_gain" ? "My weight gain journey" : "My weight loss journey"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Starting" value={start != null ? `${start} kg` : "—"} />
              <Stat label="Current" value={current != null ? `${current} kg` : "—"} />
              <Stat
                label={healthCategory === "weight_gain" ? "Gained" : "Lost"}
                value={`${Math.max(0, delta)} kg`}
                highlight
              />
            </div>

            {health.next ? (
              <div className="space-y-1">
                <Progress value={health.pct} />
                <p className="text-sm text-muted-foreground">
                  {healthCategory === "weight_gain" ? "Gain" : "Lose"} {health.remaining} more kg to unlock{" "}
                  <span className="font-medium text-foreground">{health.next.name}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All milestones unlocked. Outstanding work!</p>
            )}

            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
              {health.visible.map((m, i) => (
                <MilestoneBadge
                  key={m.def.id}
                  icon={m.def.icon}
                  name={m.def.name}
                  unlocked={m.unlocked}
                  tier={tierForIndex(i, health.visible.length)}
                  inProgress={health.next?.id === m.def.id}
                  progressPct={health.pct}
                  caption={
                    unlockedAt.get(m.def.id) ? formatDate(unlockedAt.get(m.def.id)!.slice(0, 10)) : undefined
                  }
                />
              ))}
            </div>

            {health.hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {health.hiddenCount} further milestone{health.hiddenCount === 1 ? "" : "s"} unlock automatically if the
                goal is extended.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-6">
              <div>
                <p className="text-3xl font-bold">{activeReferralCount}</p>
                <p className="text-sm text-muted-foreground">Active frontline</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-muted-foreground">{totalReferralCount}</p>
                <p className="text-sm text-muted-foreground">Total referred</p>
              </div>
            </div>
            <Badge
              variant={community.current ? "default" : "secondary"}
              className={`text-sm ${
                community.current && !currentActivity?.met_requirement
                  ? "border-2 border-amber-500"
                  : ""
              }`}
            >
              {community.current ? `${community.current.icon} ${community.current.name}` : "No title yet"}
            </Badge>
          </div>

          {!ownMembershipActive && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>Your own membership must be active to hold a coach title.</span>
            </div>
          )}

          {community.next ? (
            <div className="space-y-1">
              <Progress value={community.pct} />
              <p className="text-sm text-muted-foreground">
                Help {community.remaining} more {community.remaining === 1 ? "person" : "people"} to unlock{" "}
                <span className="font-medium text-foreground">{community.next.name}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Highest referral milestone reached. Congratulations!
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {community.visible.map((m, i) => (
              <MilestoneBadge
                key={m.def.id}
                size="sm"
                icon={m.def.icon}
                name={m.def.name}
                unlocked={m.unlocked}
                tier={tierForIndex(i, community.visible.length)}
                inProgress={community.next?.id === m.def.id}
                progressPct={community.pct}
              />
            ))}
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarCheck className="h-4 w-4" /> Monthly activity
            </p>
            <div className="flex items-center justify-between text-sm">
              <span>{MONTH_LABEL(thisMonth)}</span>
              <span
                className={`flex items-center gap-1 font-medium ${
                  currentActivity?.met_requirement ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {currentActivity?.new_memberships ?? 0} of{" "}
                {currentActivity?.required_memberships ?? (community.current && community.current.sort_order > 4 ? 2 : 1)}{" "}
                new memberships
                {currentActivity?.met_requirement ? <Check className="h-4 w-4" /> : null}
              </span>
            </div>
            {recentActivity.map((a) => (
              <div key={a.month} className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{MONTH_LABEL(a.month)}</span>
                <span className="flex items-center gap-1">
                  {a.new_memberships} of {a.required_memberships}
                  {a.met_requirement ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Add {community.current && community.current.sort_order > 4 ? "2 new memberships" : "1 new membership"} to
              your frontline each month to keep this title. Titles also need your own membership active and enough
              active frontline members.
            </p>
          </div>

          {referrals && referrals.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">People helped</p>
              {referrals.map((r) => {
                const active = isActiveMemberStatus(r.status);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className={active ? "" : "text-muted-foreground"}>{r.full_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={active ? "default" : "outline"} className="text-xs">
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(r.joining_date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}


function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${highlight ? "text-xl text-primary" : "text-base"}`}>{value}</p>
    </div>
  );
}
