import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Package } from "lucide-react";
import { MemberModeFilter, useTodayServingsIssued } from "@/hooks/useWellness";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { formatDate } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberMode: MemberModeFilter;
}

export function ServingsIssuedSheet({ open, onOpenChange, memberMode }: Props) {
  const { data, isLoading } = useTodayServingsIssued(memberMode);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Servings issued today
            </SheetTitle>
            <SheetDescription>
              {data?.totalServings ?? 0} servings to {data?.totalMembers ?? 0} members
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !data?.rows.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No servings issued today yet.</p>
            ) : (
              data.rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.memberId)}
                  className="w-full space-y-1 rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{r.memberName}</p>
                      <p className="text-xs text-muted-foreground">{r.mobile}</p>
                    </div>
                    <Badge variant="secondary">
                      {r.quantity} {r.quantity === 1 ? "serving" : "servings"}
                    </Badge>
                  </div>
                  {r.reason && <p className="text-xs italic text-muted-foreground">"{r.reason}"</p>}
                  {r.markedDates.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">For: {r.markedDates.map((d) => formatDate(d)).join(", ")}</p>
                  )}
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(r.issuedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </p>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      <MemberSheetById memberId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
