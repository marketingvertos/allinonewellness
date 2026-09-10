import { BodyMeasurement, WellnessMember } from "@/hooks/useWellness";
import { formatDate } from "@/lib/formatters";
import { ageFromDob, bmiCategory, getRange } from "./bodyEvalConstants";

interface Props {
  member: WellnessMember;
  evaluation: BodyMeasurement;
}

const PARAMS: { key: keyof BodyMeasurement; label: string; unit: string; normal: string; high: string; risk: string }[] = [
  { key: "trunk_fat", label: "Trunk fat (TSF)", unit: "%", normal: "below 15", high: "16 – 18", risk: "18 +" },
  { key: "muscle_mass", label: "Muscle mass (MM)", unit: "kg", normal: "10 – 20 M / 20 – 30 F", high: "21 – 25 M / 30 – 35 F", risk: "25 + M / 35 + F" },
  { key: "body_fat_percentage", label: "Body fat", unit: "%", normal: "up to 33 M / 30 F", high: "34 – 36 M / 31 – 33 F", risk: "above" },
  { key: "visceral_fat", label: "Visceral fat (VF)", unit: "", normal: "2 – 8", high: "9 – 14", risk: "15 +" },
  { key: "bmr", label: "BMR", unit: "kcal/day", normal: "—", high: "—", risk: "—" },
  { key: "body_age", label: "Body age", unit: "yrs", normal: "—", high: "—", risk: "—" },
  { key: "waist", label: "Waist", unit: "cm", normal: "—", high: "—", risk: "—" },
  { key: "hip", label: "Hip", unit: "cm", normal: "—", high: "—", risk: "—" },
  { key: "chest", label: "Chest", unit: "cm", normal: "—", high: "—", risk: "—" },
];

export function BodyEvalPrintCard({ member, evaluation }: Props) {
  const overUnder =
    evaluation.weight != null && evaluation.ideal_weight != null
      ? Number((evaluation.weight - evaluation.ideal_weight).toFixed(1))
      : null;
  const actualAge = ageFromDob(member.date_of_birth);

  return (
    <div className="body-eval-print hidden print:block">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .body-eval-print, .body-eval-print * { visibility: visible !important; }
          .body-eval-print { position: absolute; inset: 0; padding: 16px; }
        }
      `}</style>
      <div className="space-y-3 text-black">
        <div className="border-b pb-2 text-center">
          <p className="text-lg font-bold">All In One Wellness · Family Health Club</p>
          <p className="text-sm">Body Evaluation Report Card</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><strong>Name:</strong> {member.full_name}</p>
          <p><strong>Date:</strong> {formatDate(evaluation.recorded_date)}</p>
          <p><strong>Height:</strong> {member.height ? `${member.height} cm` : "—"}</p>
          <p><strong>Weight:</strong> {evaluation.weight != null ? `${evaluation.weight} kg` : "—"}</p>
          <p><strong>Age:</strong> {actualAge != null ? `${actualAge} yrs` : "—"}</p>
          <p><strong>Gender:</strong> {member.gender ?? "—"}</p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Parameter", "Value", "Normal", "High", "Risk"].map((h) => (
                <th key={h} className="border px-2 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARAMS.map((p) => {
              const v = evaluation[p.key] as number | null;
              return (
                <tr key={p.key as string}>
                  <td className="border px-2 py-1">{p.label}</td>
                  <td className="border px-2 py-1">{v != null ? `${v} ${p.unit}`.trim() : "—"}</td>
                  <td className="border px-2 py-1">{p.normal}</td>
                  <td className="border px-2 py-1">{p.high}</td>
                  <td className="border px-2 py-1">{p.risk}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="text-sm">
          <p>
            <strong>BMI:</strong>{" "}
            {evaluation.bmi != null ? `${evaluation.bmi} — ${bmiCategory(Number(evaluation.bmi))}` : "—"}
            {evaluation.bmi != null && getRange("bmi", Number(evaluation.bmi)) ? "" : ""}
          </p>
          <p>
            <strong>Ideal weight (WHO):</strong>{" "}
            {evaluation.ideal_weight != null ? `${evaluation.ideal_weight} kg` : "—"}
            {overUnder != null && overUnder !== 0
              ? ` · ${Math.abs(overUnder)} kg ${overUnder > 0 ? "over" : "under"}`
              : ""}
          </p>
          <p><strong>Remark:</strong> {evaluation.remark || "—"}</p>
        </div>

        <div className="border-t pt-2 text-xs">
          <p className="font-semibold">General instructions</p>
          <p>
            Drink 3–4 litres of water daily, follow the nutrition plan advised by your coach, keep to the
            recommended activity level and attend your evaluation every 15 days.
          </p>
        </div>
      </div>
    </div>
  );
}
