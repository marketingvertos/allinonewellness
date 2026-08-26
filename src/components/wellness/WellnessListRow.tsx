import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Badges / small stats, wrap onto their own line on phones. */
  badges?: React.ReactNode;
  /** Actions, full-width on phones. */
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Mobile-first list row used across the Wellness module: stacked on phones,
 * single line from `sm` upwards.
 */
export function WellnessListRow({ title, meta, badges, actions, onClick, className, children }: Props) {
  const interactive = typeof onClick === "function";
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors sm:p-4",
        interactive && "cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {meta && <p className="mt-0.5 break-words text-sm text-muted-foreground">{meta}</p>}
        </div>
        {badges && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{badges}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
      {actions && (
        <div className="mt-3 flex flex-col gap-2 sm:mt-3 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
