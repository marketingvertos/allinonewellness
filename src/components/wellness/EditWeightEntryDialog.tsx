import { useEffect, useState } from "react";
import { useUpdateWeightEntry } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export interface WeightEntry {
  id: string;
  member_id?: string;
  recorded_date: string;
  weight: number;
  notes?: string | null;
}

interface Props {
  memberId: string;
  entry: WeightEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWeightEntryDialog({ memberId, entry, open, onOpenChange }: Props) {
  const update = useUpdateWeightEntry();
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !entry) return;
    setDate(entry.recorded_date);
    setWeight(String(entry.weight));
    setNotes(entry.notes ?? "");
  }, [open, entry]);

  const submit = async () => {
    if (!entry) return;
    await update.mutateAsync({
      id: entry.id,
      member_id: memberId,
      recorded_date: date,
      weight: Number(weight),
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit reading"
      description="Correct a mistaken bait reading or its date."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!weight || !date || update.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ew-date">Date</Label>
          <Input id="ew-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ew-weight">Bait (kg)</Label>
          <Input id="ew-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ew-notes">Note (optional)</Label>
          <Textarea id="ew-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
