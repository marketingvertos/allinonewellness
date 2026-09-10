import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DisplayLayout } from "./DisplayLayout";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly";

interface Row {
  member_name: string;
  goal: string;
  initial_weight: number;
  current_weight: number;
  previous_weight: number;
  change: number;
  total_change: number;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function useDisplayWeightChanges(period: Period) {
  return useQuery({
    queryKey: ["display-weight-changes", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("display_weight_changes", { p_period: period });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 60000,
  });
}

const kg = (n: number) => `${Math.abs(Number(n)).toFixed(1)} kg`;

function Section({ title, rows, gain }: { title: string; rows: Row[]; gain: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b-2 border-primary pb-2 text-xl font-bold uppercase tracking-wide sm:text-2xl">
        {title} <span className="text-muted-foreground">({rows.length})</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-base sm:text-lg">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground sm:text-sm">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2 text-right">Start</th>
              <th className="px-2 py-2 text-right">Current</th>
              <th className="px-2 py-2 text-right">Change</th>
              <th className="px-2 py-2 text-right">{gain ? "Total gain" : "Total loss"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const towardsGoal = gain ? r.change > 0 : r.change < 0;
              const total = gain ? r.total_change : -r.total_change;
              return (
                <tr key={r.member_name + i} className="border-t">
                  <td className="px-2 py-2.5 text-lg font-bold tabular-nums text-muted-foreground sm:text-xl">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2.5 font-semibold">{r.member_name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{Number(r.initial_weight).toFixed(1)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{Number(r.current_weight).toFixed(1)}</td>
                  <td
                    className={cn(
                      "px-2 py-2.5 text-right font-semibold tabular-nums",
                      Number(r.change) === 0
                        ? "text-muted-foreground"
                        : towardsGoal
                          ? "text-emerald-600"
                          : "text-destructive",
                    )}
                  >
                    {Number(r.change) === 0 ? "—" : `${Number(r.change) > 0 ? "+" : "-"}${kg(r.change)}`}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-lg font-bold tabular-nums sm:text-xl",
                        total > 0 ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {gain ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                      {kg(r.total_change)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DisplayWeightChanges() {
  const [period, setPeriod] = useState<Period>("daily");
  const { data, isLoading } = useDisplayWeightChanges(period);

  const rows = data ?? [];
  const gainRows = rows.filter((r) => r.goal === "weight_gain");
  const lossRows = rows.filter((r) => r.goal !== "weight_gain");

  return (
    <DisplayLayout
      title="Weight Progress"
      filters={PERIODS.map((p) => (
        <Button
          key={p.value}
          size="lg"
          variant={period === p.value ? "default" : "outline"}
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
        </Button>
      ))}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          <Section title="Weight Loss" rows={lossRows} gain={false} />
          <Section title="Weight Gain" rows={gainRows} gain />
        </div>
      ) : (
        <p className="py-24 text-center text-xl text-muted-foreground">No weight progress recorded yet.</p>
      )}
    </DisplayLayout>
  );
}
