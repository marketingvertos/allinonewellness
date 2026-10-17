import { useMemo, useState } from "react";
import { Eye, EyeOff, IndianRupee, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberModeFilter, periodRange, useSalesAnalytics } from "@/hooks/useWellness";
import { MASKED_AMOUNT } from "@/hooks/useRevealMoney";
import { formatCurrency, todayIst } from "@/lib/formatters";
import { SalesDrillDownSheet } from "@/components/wellness/SalesDrillDownSheet";

type Period = "today" | "week" | "month" | "last_month" | "last30" | "last90" | "fy" | "custom";

const LABELS: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  last30: "Last 30 days",
  last90: "Last 90 days",
  fy: "This financial year",
  custom: "Custom range",
};

const DAY = 86_400_000;
const shift = (d: string, days: number) => new Date(Date.parse(d + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY) + 1;

export function rangeFor(period: Period, today: string, custom: { from: string; to: string }) {
  if (period === "custom") return custom;
  if (period === "last90") return { from: shift(today, -89), to: today };
  if (period === "fy") {
    const [y, m] = today.split("-").map(Number);
    const startYear = m >= 4 ? y : y - 1;
    return { from: `${startYear}-04-01`, to: today };
  }
  return periodRange(period);
}

interface Props {
  mode: MemberModeFilter;
  revealed: boolean;
  canReveal: boolean;
  onToggle: () => void;
  onSelectMember: (id: string) => void;
  children?: React.ReactNode;
}

export function RevenueCard({ mode, revealed, canReveal, onToggle, onSelectMember, children }: Props) {
  const today = todayIst();
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState({ from: shift(today, -6), to: today });
  const [drill, setDrill] = useState(false);

  const range = useMemo(() => rangeFor(period, today, custom), [period, today, custom]);
  const prev = useMemo(() => {
    const len = daysBetween(range.from, range.to);
    return { from: shift(range.from, -len), to: shift(range.from, -1) };
  }, [range]);

  const { data } = useSalesAnalytics(range, mode);
  const { data: prevData } = useSalesAnalytics(prev, mode);
  const change = prevData && prevData.revenue > 0 && data ? ((data.revenue - prevData.revenue) / prevData.revenue) * 100 : null;
  const show = (v: number) => (revealed ? formatCurrency(v) : MASKED_AMOUNT);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <IndianRupee className="h-4 w-4 text-muted-foreground" /> Revenue
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>{LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canReveal ? (
            <Button variant="outline" size="sm" onClick={onToggle} aria-pressed={revealed}>
              {revealed ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
              {revealed ? "Hide" : "Show"}
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Admin only</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {period === "custom" && (
          <div className="mb-3 flex flex-wrap gap-2">
            <Input type="date" className="h-8 w-auto" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
            <Input type="date" className="h-8 w-auto" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <button
          type="button"
          disabled={!revealed}
          onClick={() => setDrill(true)}
          className="w-full rounded-md text-left disabled:cursor-default enabled:hover:bg-accent/30"
        >
          <p className="text-3xl font-bold tracking-tight">{show(data?.revenue ?? 0)}</p>
          {revealed && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {data?.memberships ?? 0} plans sold
                {change !== null && (
                  <span className={change >= 0 ? "ml-2 text-primary" : "ml-2 text-destructive"}>
                    {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs previous period
                  </span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">New</p><p className="font-semibold">{show(data?.newRevenue ?? 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Renewals</p><p className="font-semibold">{show(data?.renewalRevenue ?? 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">Trials</p><p className="font-semibold">{show(data?.trialRevenue ?? 0)}</p></div>
                <div><p className="text-xs text-muted-foreground">MIW</p><p className="font-semibold">{show(data?.miwRevenue ?? 0)}</p></div>
              </div>
            </>
          )}
        </button>
        {children}
      </CardContent>
      {drill && revealed && (
        <SalesDrillDownSheet
          open
          onOpenChange={(o) => !o && setDrill(false)}
          period="today"
          range={range}
          periodLabel={LABELS[period]}
          memberMode={mode}
          onSelectMember={onSelectMember}
        />
      )}
    </Card>
  );
}
