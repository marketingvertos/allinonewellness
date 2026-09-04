import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAddBodyMeasurement, useUpdateBodyMeasurement, BodyMeasurement } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface Props {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this measurement set instead of adding a new one. */
  entry?: BodyMeasurement | null;
}

const EMPTY = { waist: "", hip: "", chest: "", body_fat_percentage: "" };

export function RecordMeasurementDialog({ memberId, open, onOpenChange, entry }: Props) {
  const { user } = useAuth();
  const add = useAddBodyMeasurement();
  const update = useUpdateBodyMeasurement();
  const [form, setForm] = useState(EMPTY);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        waist: entry.waist?.toString() ?? "",
        hip: entry.hip?.toString() ?? "",
        chest: entry.chest?.toString() ?? "",
        body_fat_percentage: entry.body_fat_percentage?.toString() ?? "",
      });
      setDate(entry.recorded_date);
    } else {
      setForm(EMPTY);
      setDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }
  }, [open, entry]);

  const num = (v: string) => (v ? Number(v) : null);

  const submit = async () => {
    const values = {
      recorded_date: date,
      waist: num(form.waist),
      hip: num(form.hip),
      chest: num(form.chest),
      body_fat_percentage: num(form.body_fat_percentage),
    };
    if (entry) {
      await update.mutateAsync({ id: entry.id, ...values });
    } else {
      if (!user) return;
      await add.mutateAsync({ member_id: memberId, recorded_by: user.id, ...values });
    }
    setForm(EMPTY);
    onOpenChange(false);
  };

  const fields: [keyof typeof form, string][] = [
    ["waist", "Waist (cm)"],
    ["hip", "Hip (cm)"],
    ["chest", "Chest (cm)"],
    ["body_fat_percentage", "Body fat (%)"],
  ];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "Edit body measurements" : "Record body measurements"}
      description="Leave blank anything you did not measure."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={add.isPending || update.isPending || !Object.values(form).some(Boolean)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bm-date">Date</Label>
          <Input id="bm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {fields.map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`bm-${key}`}>{label}</Label>
            <Input
              id={`bm-${key}`}
              inputMode="decimal"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </ResponsiveDialog>
  );
}
