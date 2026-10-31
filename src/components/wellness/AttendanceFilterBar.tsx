import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceRow } from "@/hooks/useWellness";

export interface AttendanceFilters {
  statuses: Set<string>;
  servingRange: string | null;
  lastSeenRange: string | null;
  sortBy: "name" | "lastVisit" | "servings";
}

export const DEFAULT_FILTERS: AttendanceFilters = {
  statuses: new Set(),
  servingRange: null,
  lastSeenRange: null,
  sortBy: "name",
};

const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "trial", label: "Trial" },
  { key: "active_member", label: "Active" },
  { key: "renewal_due", label: "Renewal Due" },
  { key: "expired", label: "Expired" },
];

const SERVING_RANGES: { key: string; label: string; min: number; max: number }[] = [
  { key: "0-5", label: "0–5", min: 0, max: 5 },
  { key: "5-10", label: "5–10", min: 5, max: 10 },
  { key: "10-20", label: "10–20", min: 10, max: 20 },
  { key: "20-30", label: "20–30", min: 20, max: 30 },
  { key: "30+", label: "30+", min: 30, max: Infinity },
];

const LAST_SEEN_RANGES: { key: string; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "30d+", label: "30+ days ago" },
  { key: "never", label: "Never visited" },
];

const SORT_OPTIONS: { key: AttendanceFilters["sortBy"]; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "lastVisit", label: "Last Visit" },
  { key: "servings", label: "Servings" },
];

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.floor((db - da) / 86_400_000);
}

function matchServingRange(servings: number | null, rangeKey: string): boolean {
  const s = servings ?? 0;
  const range = SERVING_RANGES.find((r) => r.key === rangeKey);
  if (!range) return true;
  if (range.max === Infinity) return s >= range.min;
  return s >= range.min && s <= range.max;
}

function matchLastSeen(lastVisitDate: string | null, rangeKey: string, today: string): boolean {
  if (rangeKey === "never") return !lastVisitDate;
  if (!lastVisitDate) return false;
  const days = daysBetween(lastVisitDate, today);
  if (rangeKey === "7d") return days <= 7;
  if (rangeKey === "30d") return days <= 30;
  if (rangeKey === "30d+") return days > 30;
  return true;
}

export function applyAttendanceFilters(
  rows: AttendanceRow[],
  filters: AttendanceFilters,
  today: string,
): AttendanceRow[] {
  let result = rows;

  if (filters.statuses.size > 0) {
    result = result.filter((r) => filters.statuses.has(r.status));
  }
  if (filters.servingRange) {
    result = result.filter((r) => matchServingRange(r.remainingServings, filters.servingRange!));
  }
  if (filters.lastSeenRange) {
    result = result.filter((r) => matchLastSeen(r.lastVisitDate, filters.lastSeenRange!, today));
  }

  if (filters.sortBy === "lastVisit") {
    result = [...result].sort((a, b) => (b.lastVisitDate ?? "").localeCompare(a.lastVisitDate ?? ""));
  } else if (filters.sortBy === "servings") {
    result = [...result].sort((a, b) => (a.remainingServings ?? 0) - (b.remainingServings ?? 0));
  }

  return result;
}

export function formatLastSeen(lastVisitDate: string | null, today: string): { text: string; warn: boolean } {
  if (!lastVisitDate) return { text: "Never visited", warn: true };
  const days = daysBetween(lastVisitDate, today);
  if (days === 0) return { text: "Today", warn: false };
  if (days === 1) return { text: "Yesterday", warn: false };
  if (days <= 7) return { text: `${days} days ago`, warn: false };
  const [y, m, d] = lastVisitDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const [ty] = today.split("-").map(Number);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", timeZone: "UTC" };
  if (y !== ty) opts.year = "numeric";
  return { text: dt.toLocaleDateString("en-IN", opts), warn: days > 30 };
}

function activeFilterCount(f: AttendanceFilters): number {
  let n = f.statuses.size;
  if (f.servingRange) n++;
  if (f.lastSeenRange) n++;
  if (f.sortBy !== "name") n++;
  return n;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

export function AttendanceFilterBar({
  filters,
  onChange,
}: {
  filters: AttendanceFilters;
  onChange: (f: AttendanceFilters) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = activeFilterCount(filters);

  const toggleStatus = (key: string) => {
    const next = new Set(filters.statuses);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...filters, statuses: next });
  };

  const setServing = (key: string) =>
    onChange({ ...filters, servingRange: filters.servingRange === key ? null : key });

  const setLastSeen = (key: string) =>
    onChange({ ...filters, lastSeenRange: filters.lastSeenRange === key ? null : key });

  const cycleSort = () => {
    const keys = SORT_OPTIONS.map((o) => o.key);
    const idx = keys.indexOf(filters.sortBy);
    onChange({ ...filters, sortBy: keys[(idx + 1) % keys.length] });
  };

  const clear = () => onChange({ ...DEFAULT_FILTERS });

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={expanded ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => setExpanded((v) => !v)}>
          <Filter className="h-3.5 w-3.5" />
          Filters
          {count > 0 && (
            <Badge variant={expanded ? "secondary" : "default"} className="ml-0.5 h-5 min-w-[20px] justify-center px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={cycleSort}>
          <ArrowUpDown className="h-3.5 w-3.5" />
          {SORT_OPTIONS.find((o) => o.key === filters.sortBy)?.label}
        </Button>

        {count > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-xs text-muted-foreground" onClick={clear}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <Chip key={o.key} label={o.label} active={filters.statuses.has(o.key)} onClick={() => toggleStatus(o.key)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Servings Left</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVING_RANGES.map((o) => (
                <Chip key={o.key} label={o.label} active={filters.servingRange === o.key} onClick={() => setServing(o.key)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Last Seen</p>
            <div className="flex flex-wrap gap-1.5">
              {LAST_SEEN_RANGES.map((o) => (
                <Chip key={o.key} label={o.label} active={filters.lastSeenRange === o.key} onClick={() => setLastSeen(o.key)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
