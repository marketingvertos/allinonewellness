import { useEffect, useState } from "react";
import { EventType, WellnessEvent, useSaveEvent } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

const DEFAULT_TITLES: Record<EventType, string> = {
  family_day: "Family Day",
  lifestyle_day: "Lifestyle Day",
  miw_challenge: "MIW Challenge",
};

interface Props {
  eventType: EventType;
  month: string;
  existing?: WellnessEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleEventDialog({ eventType, month, existing, open, onOpenChange }: Props) {
  const save = useSaveEvent();
  const [title, setTitle] = useState(DEFAULT_TITLES[eventType]);
  const [date, setDate] = useState(`${month}-01`);
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title ?? DEFAULT_TITLES[eventType]);
    setDate(existing?.event_date ?? `${month}-01`);
    setEndDate(existing?.end_date ?? "");
    setDescription(existing?.description ?? "");
  }, [open, existing, eventType, month]);

  const isSunday = date ? new Date(`${date}T00:00:00`).getDay() === 0 : false;
  const needsSunday = eventType === "family_day" && !isSunday;
  const isChallenge = eventType === "miw_challenge";

  const submit = async () => {
    await save.mutateAsync({
      id: existing?.id,
      event_type: eventType,
      title: title.trim() || DEFAULT_TITLES[eventType],
      event_date: date,
      end_date: isChallenge
        ? endDate ||
          new Date(new Date(`${date}T00:00:00`).getTime() + 20 * 86400000).toISOString().slice(0, 10)
        : null,
      month: date.slice(0, 7),
      description: description.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Update event" : `Schedule ${DEFAULT_TITLES[eventType]}`}
      description={
        eventType === "family_day"
          ? "Family Day is held on a Sunday each month."
          : isChallenge
            ? "A 21-day challenge — the end date fills in automatically."
            : "Pick the day this event is held."
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!date || needsSunday || save.isPending}>
            {existing ? "Save changes" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ev-title">Title</Label>
          <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-date">{isChallenge ? "Start date" : "Date"}</Label>
          <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {needsSunday && (
            <p className="text-xs text-destructive">Please pick a Sunday for Family Day.</p>
          )}
        </div>
        {isChallenge && (
          <div className="space-y-2">
            <Label htmlFor="ev-end">End date (optional)</Label>
            <Input id="ev-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="ev-desc">Details (optional)</Label>
          <Textarea
            id="ev-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Timing, venue or anything members should know"
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
