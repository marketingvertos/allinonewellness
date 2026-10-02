import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ModeBadge } from "@/components/wellness/memberMeta";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { formatDate } from "@/lib/formatters";
import type { ActivityListItem, DashboardMember, DashboardPlan } from "@/lib/dashboardMetrics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  items: ActivityListItem[];
  memberById: Record<string, DashboardMember>;
  planById: Record<string, DashboardPlan>;
}

export function ActivityMembersSheet({ open, onOpenChange, title, description, items, memberById, planById }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle>{title} ({items.length})</SheetTitle>
            <SheetDescription>{description}. Tap a person to see the full profile.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {items.length ? (
              items.map((it) => {
                const m = memberById[it.memberId];
                const plan = it.planId ? planById[it.planId] : undefined;
                return (
                  <button
                    key={it.memberId + it.label}
                    onClick={() => setSelectedId(it.memberId)}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{m?.full_name ?? "Member"}</span>
                      <Badge variant="secondary">{it.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {m?.mobile_number && <span>{m.mobile_number}</span>}
                      <ModeBadge mode={m?.member_mode} />
                      <span>{plan?.name ?? (it.label.includes("trial") ? "Free guest trial" : it.label === "Guest" ? "Guest" : "—")}</span>
                      <span>
                        {it.endDate ? `${formatDate(it.date)} – ${formatDate(it.endDate)}` : formatDate(it.date)}
                      </span>
                      {it.amount != null && <span>₹{it.amount.toLocaleString("en-IN")}</span>}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No one in this list right now.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <MemberSheetById memberId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
