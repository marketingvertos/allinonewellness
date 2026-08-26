import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAddBodyMeasurement } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface Props {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordMeasurementDialog({ memberId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const add = useAddBodyMeasurement();
  const [form, setForm] = useState({ waist: "", hip: "", chest: "", body_fat_percentage: "" });

  const num = (v: string) => (v ? Number(v) : null);

  const submit = async () => {
    if (!user) return;
    await add.mutateAsync({
      member_id: memberId,
      recorded_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      waist: num(form.waist),
      hip: num(form.hip),
      chest: num(form.chest),
      body_fat_percentage: num(form.body_fat_percentage),
      recorded_by: user.id,
    });
    setForm({ waist: "", hip: "", chest: "", body_fat_percentage: "" });
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
      title="Record body measurements"
      description="Leave blank anything you did not measure today."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending || !Object.values(form).some(Boolean)}>Save</Button>
        </>
      }
    >
        <div className="grid gap-4 sm:grid-cols-2">
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
