import { MemberModeFilter, useServingTrend } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function BarLabel({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) {
  if (!value || value === 0) return null;
  return (
    <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fontSize={10} fontWeight={600}
      fill="hsl(var(--foreground))">
      {value}
    </text>
  );
}

export function ServingTrendChart({ days = 30, memberMode }: { days?: number; memberMode?: MemberModeFilter }) {
  const { data, isLoading } = useServingTrend(days, memberMode);

  const rows = (data ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Serving consumption (last {days} days)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="servings" name="Servings used" radius={[3, 3, 0, 0]}
                  label={<BarLabel />}>
                  {rows.map((row, i) => (
                    <Cell key={i} fill={row.servings === 0
                      ? "hsl(var(--muted))"
                      : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
