import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAddBodyMeasurement, useUpdateBodyMeasurement, BodyMeasurement } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ageFromDob } from "@/lib/formatters";
import { BodyEvalParam, bmiCategory, getRange, idealWeightFor } from "./bodyEvalConstants";

interface Props {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this evaluation instead of adding a new one. */
  entry?: BodyMeasurement | null;
  memberHeight?: number | null;
  memberGender?: string | null;
  memberDob?: string | null;
}

const EMPTY = {
  weight: "",
  trunk_fat: "",
  muscle_mass: "",
  body_fat_percentage: "",
  visceral_fat: "",
  bmr: "",
  bmi: "",
  body_age: "",
  waist: "",
  hip: "",
  chest: "",
  ideal_weight: "",
  remark: "",
};

type FormKey = keyof typeof EMPTY;

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b pb-1 text-sm font-medium text-muted-foreground sm:col-span-2">{children}</p>
  );
}

export function RecordMeasurementDialog({
  memberId,
  open,
  onOpenChange,
  entry,
  memberHeight,
  memberGender,
  memberDob,
}: Props) {
  const { user } = useAuth();
  const add = useAddBodyMeasurement();
  const update = useUpdateBodyMeasurement();
  const [form, setForm] = useState(EMPTY);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        weight: entry.weight?.toString() ?? "",
        trunk_fat: entry.trunk_fat?.toString() ?? "",
        muscle_mass: entry.muscle_mass?.toString() ?? "",
        body_fat_percentage: entry.body_fat_percentage?.toString() ?? "",
        visceral_fat: entry.visceral_fat?.toString() ?? "",
        bmr: entry.bmr?.toString() ?? "",
        bmi: entry.bmi?.toString() ?? "",
        body_age: entry.body_age?.toString() ?? "",
        waist: entry.waist?.toString() ?? "",
        hip: entry.hip?.toString() ?? "",
        chest: entry.chest?.toString() ?? "",
        ideal_weight: entry.ideal_weight?.toString() ?? "",
        remark: entry.remark ?? "",
      });
      setDate(entry.recorded_date);
    } else {
      setForm({
        ...EMPTY,
        ideal_weight: memberHeight ? idealWeightFor(Number(memberHeight), memberGender).toString() : "",
      });
      setDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    }
  }, [open, entry, memberHeight, memberGender]);

  // Auto-fill BMI from weight + profile height (still editable).
  useEffect(() => {
    const w = Number(form.weight);
    if (!form.weight || !memberHeight || !(w > 0)) return;
    const h = Number(memberHeight) / 100;
    if (!(h > 0)) return;
    const calc = (w / (h * h)).toFixed(1);
    setForm((f) => (f.bmi === calc ? f : { ...f, bmi: calc }));
  }, [form.weight, memberHeight]);

  const num = (v: string) => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
  const set = (key: FormKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const actualAge = ageFromDob(memberDob);
  const bodyAgeNum = num(form.body_age);
  const overUnder =
    num(form.weight) != null && num(form.ideal_weight) != null
      ? Number((Number(form.weight) - Number(form.ideal_weight)).toFixed(1))
      : null;

  const submit = async () => {
    const values = {
      recorded_date: date,
      weight: num(form.weight),
      trunk_fat: num(form.trunk_fat),
      muscle_mass: num(form.muscle_mass),
      body_fat_percentage: num(form.body_fat_percentage),
      visceral_fat: num(form.visceral_fat),
      bmr: num(form.bmr),
      bmi: num(form.bmi),
      body_age: form.body_age ? parseInt(form.body_age, 10) : null,
      waist: num(form.waist),
      hip: num(form.hip),
      chest: num(form.chest),
      ideal_weight: num(form.ideal_weight),
      remark: form.remark.trim() || null,
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

  const rangeBadge = (param: BodyEvalParam, value: string) => {
    const n = num(value);
    if (n == null) return null;
    const r = getRange(param, n, memberGender);
    if (!r) return null;
    return (
      <Badge variant="outline" className={`shrink-0 ${r.className}`}>
        {r.label}
      </Badge>
    );
  };

  const field = (key: FormKey, label: string, param?: BodyEvalParam, hint?: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={`be-${key}`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`be-${key}`}
          inputMode="decimal"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
        />
        {param && rangeBadge(param, form[key])}
      </div>
      {hint}
    </div>
  );

  const hasAny = Object.values(form).some((v) => v !== "");

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Body Evaluation"
      description="Record all parameters from the body composition analyzer. Leave blank anything you did not measure."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending || update.isPending || !hasAny}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="be-date">Date</Label>
          <Input id="be-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <SectionHeader>Basic</SectionHeader>
        {field(
          "weight",
          "Weight (kg)",
          undefined,
          <p className="text-xs text-muted-foreground">
            {memberHeight ? `Height: ${memberHeight} cm (from profile)` : "Height: not set — update member profile."}
          </p>,
        )}
        {field(
          "bmi",
          "BMI",
          "bmi",
          num(form.bmi) != null ? (
            <p className="text-xs text-muted-foreground">{bmiCategory(Number(form.bmi))}</p>
          ) : null,
        )}
        {field(
          "ideal_weight",
          "Ideal weight (kg)",
          undefined,
          overUnder != null && overUnder !== 0 ? (
            <p className={`text-xs ${overUnder > 0 ? "text-destructive" : "text-primary"}`}>
              {Math.abs(overUnder)} kg {overUnder > 0 ? "over" : "under"} ideal weight
            </p>
          ) : null,
        )}
        <div className="hidden sm:block" />

        <SectionHeader>Body composition</SectionHeader>
        {field("trunk_fat", "Trunk fat / TSF (%)", "trunk_fat")}
        {field("muscle_mass", "Muscle mass / MM (kg)", "muscle_mass")}
        {field("body_fat_percentage", "Body fat (%)", "body_fat_percentage")}
        {field("visceral_fat", "Visceral fat / VF", "visceral_fat")}

        <SectionHeader>Metabolic</SectionHeader>
        {field("bmr", "BMR (kcal/day)")}
        {field(
          "body_age",
          "Body age (years)",
          undefined,
          actualAge != null ? (
            <p
              className={`text-xs ${
                bodyAgeNum == null
                  ? "text-muted-foreground"
                  : bodyAgeNum < actualAge
                    ? "text-primary"
                    : bodyAgeNum > actualAge
                      ? "text-destructive"
                      : "text-muted-foreground"
              }`}
            >
              Actual age: {actualAge} yrs
              {bodyAgeNum != null && bodyAgeNum !== actualAge
                ? ` · ${Math.abs(bodyAgeNum - actualAge)} yrs ${bodyAgeNum < actualAge ? "younger" : "older"}`
                : ""}
            </p>
          ) : null,
        )}

        <SectionHeader>Physical measurements</SectionHeader>
        {field("waist", "Waist (cm)")}
        {field("hip", "Hip (cm)")}
        {field("chest", "Chest (cm)")}
        <div className="hidden sm:block" />

        <SectionHeader>Notes</SectionHeader>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="be-remark">Remark</Label>
          <Textarea
            id="be-remark"
            rows={2}
            value={form.remark}
            onChange={(e) => set("remark", e.target.value)}
            placeholder="Evaluator notes"
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
