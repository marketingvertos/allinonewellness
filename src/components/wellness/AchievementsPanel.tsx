import { useMemo } from "react";
import {
  AchievementCategory,
  buildLadder,
  useAchievementDefinitions,
  useMemberReferrals,
  useUnlockedAchievements,
} from "@/hooks/useAchievements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/formatters";
import { Lock, Trophy, Users } from "lucide-react";

interface MemberLike {
  id: string;
  goal: string | null;
  initial_weight: number | null;
  current_weight: number | null;
}

interface Props {
  member: MemberLike;
  weights?: { recorded_date: string; weight: number }[];
  compact?: boolean;
}

export function AchievementsPanel({ member, weights = [], compact = false }: Props) {
  const { data: defs } = useAchievementDefinitions(true);
  const { data: unlocked } = useUnlockedAchievements(member.id);
  const { data: referrals } = useMemberReferrals(member.id);

  const unlockedIds = useMemo(
    () => new Set((unlocked ?? []).map((u) => u.achievement_id)),
    [unlocked],
  );

  const referralCount = (referrals ?? []).filter((r) => r.status !== "inactive").length;

  const start = member.initial_weight ?? weights[0]?.weight ?? null;
  const current = weights.length ? weights[weights.length - 1].weight : member.current_weight;

  const healthCategory: AchievementCategory = member.goal === "weight_gain" ? "weight_gain" : "weight_loss";
  const delta =
    start != null && current != null
      ? Number((healthCategory === "weight_gain" ? current - start : start - current).toFixed(1))
      : 0;

  const community = buildLadder("referral", defs ?? [], unlockedIds, referralCount);
  const health = buildLadder(healthCategory, defs ?? [], unlockedIds, Math.max(0, delta));

  const showHealth =
    !!member.goal && ["weight_loss", "fat_loss", "weight_gain", "body_transformation"].includes(member.goal);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-3xl font-bold">{referralCount}</p>
              <p className="text-sm text-muted-foreground">People helped to join</p>
            </div>
            <Badge variant={community.current ? "default" : "secondary"} className="text-sm">
              {community.current ? `${community.current.icon} ${community.current.name}` : "No title yet"}
            </Badge>
          </div>

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

          <div className="flex flex-wrap gap-2">
            {community.milestones.map((m) => (
              <span
                key={m.def.id}
                className={`rounded-full border px-2 py-1 text-xs ${
                  m.unlocked ? "border-primary/40 bg-primary/10 font-medium" : "text-muted-foreground"
                }`}
              >
                {m.unlocked ? m.def.icon : "🔒"} {m.def.name}
              </span>
            ))}
          </div>

          {referrals && referrals.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">People helped</p>
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{r.full_name}</span>
                  <span className="text-muted-foreground">
                    {formatDate(r.joining_date)} · {r.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

            <div className="space-y-1">
              {health.milestones.map((m) => (
                <div
                  key={m.def.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    m.unlocked ? "border-primary/40 bg-primary/5" : "text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {m.unlocked ? <span>{m.def.icon}</span> : <Lock className="h-3.5 w-3.5" />}
                    {m.def.name}
                  </span>
                  <span className="text-xs uppercase tracking-wide">{m.unlocked ? "Unlocked" : "Locked"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
