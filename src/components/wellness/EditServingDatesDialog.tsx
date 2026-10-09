import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useEditServingDates, useMemberAttendanceOnDates } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { CalendarIcon } from "lucide-react";
import { todayIst } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const isoToLocal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addIsoDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  txnId: string;
  quantity: number;
  currentDates: string[];
}

/** Move the dates a packed-serving entry covers. The serving balance never changes. */
export function EditServingDatesDialog({ open, onOpenChange, memberId, txnId, quantity, currentDates }: Props) {
  const edit = useEditServingDates();
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const next = [...currentDates].sort();
    while (next.length < quantity) {
      let d = next.length ? addIsoDays(next[next.length - 1], 1) : todayIst();
      while (next.includes(d)) d = addIsoDays(d, 1);
      next.push(d);
    }
    setDates(next);
  }, [open, currentDates, quantity]);

  const { data: existing } = useMemberAttendanceOnDates(open ? memberId : undefined, dates);
  // Dates already belonging to this entry are not conflicts.
  const conflicts = useMemo(
    () => new Set([...(existing ?? [])].filter((d) => !currentDates.includes(d))),
    [existing, currentDates],
  );
  const unique = new Set(dates).size === dates.length;
  const valid = unique && dates.length === quantity && dates.every((d) => !conflicts.has(d));

  const save = async () => {
    const freed = currentDates.filter((d) => !dates.includes(d) && d >= todayIst());
    await edit.mutateAsync({ txnId, dates, freed });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit serving dates"
      description="Move packed servings to the correct days. The serving balance stays the same."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || edit.isPending} onClick={save}>
            Save dates
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {currentDates.length === 0 && (
          <p className="text-xs text-muted-foreground">This entry had no dates yet. Pick the days it covered.</p>
        )}
        <p className="text-xs text-muted-foreground">
          A day freed up here (today or later) lets the member check in normally on that day.
        </p>
        {dates.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">Day {i + 1}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-start font-normal">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(isoToLocal(d), "EEE, dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={isoToLocal(d)}
                  onSelect={(v) => {
                    if (!v) return;
                    const iso = format(v, "yyyy-MM-dd");
                    setDates((prev) => prev.map((x, j) => (j === i ? iso : x)));
                  }}
                  disabled={(v) => dates.some((x, j) => j !== i && x === format(v, "yyyy-MM-dd"))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {conflicts.has(d) && <span className="text-[11px] text-destructive">Already present</span>}
          </div>
        ))}
      </div>
    </ResponsiveDialog>
  );
}
