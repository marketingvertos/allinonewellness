import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, Star } from "lucide-react";

export const MASTER_BADGE_CLASS =
  "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

export function MasterIcons({ level, className }: { level: number; className?: string }) {
  if (level >= 100) return <Crown className={cn("h-3.5 w-3.5", className)} />;
  if (level >= 40)
    return (
      <span className="flex">
        <Star className={cn("h-3 w-3 fill-current", className)} />
        <Star className={cn("-ml-1 h-3 w-3 fill-current", className)} />
      </span>
    );
  return <Star className={cn("h-3 w-3 fill-current", className)} />;
}

export function MasterTitleBadge({
  level,
  className,
  size = "default",
}: {
  level?: number | null;
  className?: string;
  size?: "default" | "sm";
}) {
  if (!level || level <= 0) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        MASTER_BADGE_CLASS,
        size === "sm" && "px-1.5 py-0 text-[10px]",
        className,
      )}
    >
      <MasterIcons level={level} />
      Master {level}
    </Badge>
  );
}
