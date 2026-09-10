import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DisplayLayout } from "./DisplayLayout";

type Category = "weight_loss" | "weight_gain";

interface AchieverRow {
  milestone_name: string;
  milestone_threshold: number;
  milestone_icon: string;
  member_name: string;
  total_change: number;
}

interface DefinitionRow {
  name: string;
  threshold: number;
  icon: string;
  sort_order: number;
}

function useMilestoneBoard(category: Category) {
  return useQuery({
    queryKey: ["display-milestones", category],
    queryFn: async () => {
      const [achievers, definitions] = await Promise.all([
        supabase.rpc("display_milestone_achievers", { p_category: category }),
        supabase.rpc("display_milestone_definitions", { p_category: category }),
      ]);
      if (achievers.error) throw achievers.error;
      if (definitions.error) throw definitions.error;
      return {
        achievers: (achievers.data ?? []) as AchieverRow[],
        definitions: (definitions.data ?? []) as DefinitionRow[],
      };
    },
    refetchInterval: 60000,
  });
}

export default function DisplayMilestones() {
  const [category, setCategory] = useState<Category>("weight_loss");
  const { data, isLoading } = useMilestoneBoard(category);

  // Each member appears only under their highest achieved milestone.
  const highest = new Map<string, number>();
  (data?.achievers ?? []).forEach((row) => {
    const current = highest.get(row.member_name);
    if (current === undefined || Number(row.milestone_threshold) > current) {
      highest.set(row.member_name, Number(row.milestone_threshold));
    }
  });

  const columns = (data?.definitions ?? []).map((d) => ({
    ...d,
    threshold: Number(d.threshold),
    members: [...highest.entries()]
      .filter(([, t]) => t === Number(d.threshold))
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b)),
  }));

  return (
    <DisplayLayout
      title="Milestone Achievers"
      filters={
        <>
          <Button
            size="lg"
            variant={category === "weight_loss" ? "default" : "outline"}
            onClick={() => setCategory("weight_loss")}
          >
            Weight Loss
          </Button>
          <Button
            size="lg"
            variant={category === "weight_gain" ? "default" : "outline"}
            onClick={() => setCategory("weight_gain")}
          >
            Weight Gain
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : columns.length ? (
        <div className="grid max-h-[calc(100vh-220px)] gap-5 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {columns.map((col) => (
            <div key={col.name} className="rounded-lg border bg-card p-3">
              <h2 className="mb-3 border-b-2 border-primary pb-2 text-xl font-bold sm:text-2xl">
                {col.threshold} kg+
                <span className="ml-2 text-base font-semibold text-muted-foreground">({col.members.length})</span>
              </h2>
              <ol className="space-y-1.5">
                {col.members.map((name, i) => (
                  <li key={name} className="text-base font-medium sm:text-lg">
                    <span className="mr-1.5 font-bold text-emerald-600 tabular-nums">{i + 1}.</span>
                    {name}
                  </li>
                ))}
                {!col.members.length && <li className="text-sm text-muted-foreground">—</li>}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-24 text-center text-xl text-muted-foreground">No milestones have been set up yet.</p>
      )}
    </DisplayLayout>
  );
}
