import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeTier = 0 | 1 | 2 | 3 | 4 | 5;

/** Tier rings driven by milestone position — bronze through crown. */
const TIERS: { ring: string; face: string; text: string }[] = [
  { ring: "ring-amber-600/50", face: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400" },
  { ring: "ring-slate-400/60", face: "bg-slate-400/15", text: "text-slate-600 dark:text-slate-300" },
  { ring: "ring-yellow-500/60", face: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-400" },
  { ring: "ring-cyan-500/60", face: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-400" },
  { ring: "ring-violet-500/60", face: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-400" },
  { ring: "ring-primary/60", face: "bg-primary/15", text: "text-primary" },
];

export function tierForIndex(index: number, total: number): BadgeTier {
  if (total <= 1) return 5;
  return Math.min(5, Math.floor((index / Math.max(total - 1, 1)) * 5)) as BadgeTier;
}

interface Props {
  icon: string;
  name: string;
  unlocked: boolean;
  tier?: BadgeTier;
  /** Renders the "next up" ring with a progress caption. */
  inProgress?: boolean;
  progressPct?: number;
  caption?: string;
  size?: "sm" | "md";
}

export function MilestoneBadge({
  icon,
  name,
  unlocked,
  tier = 0,
  inProgress = false,
  progressPct,
  caption,
  size = "md",
}: Props) {
  const t = TIERS[tier];
  const dim = size === "sm" ? "h-12 w-12 text-xl" : "h-16 w-16 text-2xl";

  return (
    <div className="flex w-full flex-col items-center gap-1.5 text-center">
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-2 transition-all",
          dim,
          unlocked
            ? cn(t.face, t.ring, "shadow-md")
            : inProgress
              ? "bg-muted ring-primary/50 ring-dashed"
              : "bg-muted ring-border",
        )}
      >
        {unlocked ? (
          <span aria-hidden>{icon}</span>
        ) : (
          <Lock className={cn("text-muted-foreground", size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
        )}
      </div>
      <p
        className={cn(
          "text-xs font-medium leading-tight",
          size === "sm" ? "max-w-[6.5rem]" : "max-w-[8rem]",
          unlocked ? t.text : "text-muted-foreground",
        )}
      >
        {name}
      </p>
      {inProgress && !unlocked && typeof progressPct === "number" && (
        <p className="text-[10px] uppercase tracking-wide text-primary">{progressPct}% there</p>
      )}
      {caption && unlocked && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
