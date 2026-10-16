import { MemberModeFilter, useServingTrend } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { date: string; label: string; club: number; issued: number; wlp: number; total: number };

function TotalLabel({ x, y, width, index, rows }: { x?: number; y?: number; width?: number; index?: number; rows: Row[] }) {
  const total = rows[index ?? 0]?.total ?? 0;
  if (!total) return null;
  return (
    <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fontSize={10} fontWeight={600}
      fill="hsl(var(--foreground))">
      {total}
    </text>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold">{r.label}</p>
      <p>Club check-ins: {r.club}</p>
      <p>Servings issued: {r.issued}</p>
      <p>WLP sessions: {r.wlp}</p>
      <p className="font-semibold">Total: {r.total}</p>
    </div>
  );
}

export function ServingTrendChart({ days = 30, memberMode }: { days?: number; memberMode?: MemberModeFilter }) {
  const { data, isLoading } = useServingTrend(days, memberMode);

  const rows: Row[] = (data ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  const sum = rows.reduce((a, r) => ({ club: a.club + r.club, issued: a.issued + r.issued, wlp: a.wlp + r.wlp }), { club: 0, issued: 0, wlp: 0 });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Serving consumption <span className="font-normal text-sm text-muted-foreground">(last {days} days)</span></CardTitle>
        <p className="text-xs text-muted-foreground">
          {sum.club} club check-ins · {sum.issued} servings issued · {sum.wlp} WLP · {sum.club + sum.issued + sum.wlp} total servings
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Club check-ins</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-issued" /> Servings issued (packed)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-wlp" /> WLP sessions</span>
        </div>
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
                <Tooltip content={<TrendTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar dataKey="club" name="Club check-ins" stackId="s" fill="hsl(var(--primary))" />
                <Bar dataKey="issued" name="Servings issued" stackId="s" fill="hsl(var(--chart-issued))" />
                <Bar dataKey="wlp" name="WLP sessions" stackId="s" fill="hsl(var(--chart-wlp))"
                  radius={[4, 4, 0, 0]} label={<TotalLabel rows={rows} />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
