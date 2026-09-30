import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  useAchievementDefinitions,
  useCoachMonthlyActivity,
  useCoachTitleStatus,
  useUnlockedAchievements,
  istMonthKey,
} from "@/hooks/useAchievements";

/** Current Ambassador title + this month's active frontline and quota, shown next to the member name. */
export function AmbassadorHeaderBadge({ memberId }: { memberId: string }) {
  const { data: defs } = useAchievementDefinitions(true);
  const { data: unlocked } = useUnlockedAchievements(memberId);
  const { data: status } = useCoachTitleStatus(memberId);
  const { data: activity } = useCoachMonthlyActivity(memberId);

  const info = useMemo(() => {
    const ladder = (defs ?? [])
      .filter((d) => d.category === "referral")
      .sort((a, b) => Number(a.threshold) - Number(b.threshold));
    const ids = new Set((unlocked ?? []).map((u) => u.achievement_id));
    const current = [...ladder].reverse().find((d) => ids.has(d.id));
    const active = status?.active_frontline_ids.length ?? 0;
    const next = ladder.find((d) => Number(d.threshold) > active && d.id !== current?.id);
    return { current, next, active };
  }, [defs, unlocked, status]);

  if (!status || (!info.current && info.active === 0)) return null;
  const month = (activity ?? []).find((a) => a.month === istMonthKey());
  const required = month?.required_memberships ?? (info.current && info.current.sort_order > 4 ? 2 : 1);
  const done = month?.new_memberships ?? status.new_frontline;
  const met = done >= required;

  return (
    <span className="flex flex-wrap items-center gap-1 text-xs font-normal">
      {info.current && (
        <Badge variant="secondary">
          {info.current.icon} {info.current.name}
        </Badge>
      )}
      <span className="text-muted-foreground">
        {info.active}
        {info.next ? ` / ${Number(info.next.threshold)} for ${info.next.name}` : " active frontline"}
      </span>
      {info.current && (
        <span className={met ? "text-emerald-600" : "text-destructive"}>
          · {done}/{required} new this month {met ? "✓" : "✗"}
        </span>
      )}
    </span>
  );
}

/** Whether this member counts toward their referrer's active frontline this month. */
export function FrontlineCountFlag({ memberId }: { memberId: string }) {
  const { data } = useCoachTitleStatus(memberId);
  if (!data) return null;
  return data.counts_for_referrer ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Counts as active frontline ✓</Badge>
  ) : (
    <p className="text-xs text-muted-foreground">Does not count as frontline this month</p>
  );
}
