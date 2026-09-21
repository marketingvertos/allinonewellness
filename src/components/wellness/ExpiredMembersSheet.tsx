import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useWellnessMembers, type MemberModeFilter, type WellnessMember } from "@/hooks/useWellness";
import { ModeBadge } from "@/components/wellness/memberMeta";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
import { formatDate } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: MemberModeFilter;
}

export function ExpiredMembersSheet({ open, onOpenChange, mode }: Props) {
  const [selected, setSelected] = useState<WellnessMember | null>(null);
  const { data: members, isLoading } = useWellnessMembers("", "expired", "all", mode, "all");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle>Expired members</SheetTitle>
            <SheetDescription>
              {members?.length ?? 0} member{(members?.length ?? 0) === 1 ? "" : "s"} with no active membership. Tap one to
              see the full profile.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            ) : members?.length ? (
              members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{m.full_name}</span>
                    <Badge variant="destructive">Expired</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{m.mobile_number}</span>
                    <ModeBadge mode={m.member_mode} />
                    {m.wellness_batches?.name && <span>{m.wellness_batches.name}</span>}
                    <span>Joined {formatDate(m.joining_date)}</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No expired members right now.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MemberDetailSheet member={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
