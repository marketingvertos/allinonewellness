export type RangeStop = { max: number; label: string; tone: "good" | "warn" | "bad" };

export const BODY_EVAL_RANGES = {
  trunk_fat: {
    label: "Trunk Fat (TSF)",
    unit: "%",
    ranges: [
      { max: 15, label: "Normal", tone: "good" },
      { max: 18, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
  },
  muscle_mass: {
    label: "Muscle Mass (MM)",
    unit: "kg",
    maleRanges: [
      { max: 20, label: "Normal", tone: "good" },
      { max: 25, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
    femaleRanges: [
      { max: 30, label: "Normal", tone: "good" },
      { max: 35, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
  },
  body_fat_percentage: {
    label: "Body Fat",
    unit: "%",
    maleRanges: [
      { max: 33, label: "Normal", tone: "good" },
      { max: 36, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
    femaleRanges: [
      { max: 30, label: "Normal", tone: "good" },
      { max: 33, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
  },
  visceral_fat: {
    label: "Visceral Fat (VF)",
    unit: "",
    ranges: [
      { max: 8, label: "Normal", tone: "good" },
      { max: 14, label: "High", tone: "warn" },
      { max: Infinity, label: "Risk", tone: "bad" },
    ] as RangeStop[],
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    ranges: [
      { max: 18, label: "Malnutrition", tone: "bad" },
      { max: 20, label: "Malnutrition 1", tone: "warn" },
      { max: 23, label: "Normal", tone: "good" },
      { max: 25, label: "Overweight", tone: "warn" },
      { max: 28, label: "Obesity Grade 1", tone: "bad" },
      { max: 30, label: "Obesity Grade 2", tone: "bad" },
      { max: Infinity, label: "Obesity Grade 3", tone: "bad" },
    ] as RangeStop[],
  },
} as const;

export type BodyEvalParam = keyof typeof BODY_EVAL_RANGES;

export const TONE_CLASS: Record<RangeStop["tone"], string> = {
  good: "border-primary/40 text-primary",
  warn: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  bad: "border-destructive/50 text-destructive",
};

export function getRange(
  param: BodyEvalParam,
  value: number,
  gender?: string | null,
): { label: string; tone: RangeStop["tone"]; className: string } | null {
  if (value == null || Number.isNaN(value)) return null;
  const config = BODY_EVAL_RANGES[param] as {
    ranges?: RangeStop[];
    maleRanges?: RangeStop[];
    femaleRanges?: RangeStop[];
  };
  const ranges = config.ranges
    ? config.ranges
    : String(gender ?? "").toLowerCase() === "female"
      ? config.femaleRanges!
      : config.maleRanges!;
  const stop = ranges.find((r) => value <= r.max) ?? ranges[ranges.length - 1];
  return { label: stop.label, tone: stop.tone, className: TONE_CLASS[stop.tone] };
}

/** Indian BMI categories used on the printed evaluation card. */
export function bmiCategory(bmi: number) {
  if (bmi < 18) return "Malnutrition";
  if (bmi <= 20) return "Malnutrition 1";
  if (bmi <= 23) return "Normal";
  if (bmi <= 25) return "Overweight";
  if (bmi <= 28) return "Obesity Grade 1";
  if (bmi <= 30) return "Obesity Grade 2";
  return "Obesity Grade 3";
}

export function idealWeightFor(heightCm: number, gender?: string | null) {
  const base = String(gender ?? "").toLowerCase() === "female" ? 45.5 : 50;
  return Math.round(base + 0.91 * (heightCm - 152.4));
}

export function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}
