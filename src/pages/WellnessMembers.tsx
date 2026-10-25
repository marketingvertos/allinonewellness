import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MemberModeFilter, useReferralCounts, useWellnessMembers, WellnessMember, WellnessStatus } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { CreateMemberDialog } from "@/components/wellness/CreateMemberDialog";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
import { statusLabel, statusVariant } from "@/components/wellness/status";
import { MEMBER_TAGS, ModeBadge, TagBadges, modeLabel, tagLabel } from "@/components/wellness/memberMeta";
import { MasterTitleBadge } from "@/components/wellness/MasterTitleBadge";
import { MissingLoginsBanner } from "@/components/wellness/MissingLoginsBanner";
import { PinkCardBadge } from "@/components/wellness/PinkCardPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WellnessListRow } from "@/components/wellness/WellnessListRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, todayIst } from "@/lib/formatters";
import { eventMatches, useMemberPlanIndex, type PlanEvent } from "@/hooks/useMemberPlanIndex";
import { downloadXlsx } from "@/lib/reportExport";

const monthOptions = () => {
  const [y, m] = todayIst().split("-").map(Number);
  return Array.from({ length: 18 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return { value: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) };
  });
};
import { Download, KeyRound, Plus, RotateCcw, Search, SearchX, Users, X } from "lucide-react";

const STATUSES: (WellnessStatus | "all")[] = [
  "all",
  "lead",
  "trial",
  "active_member",
  "renewal_due",
  "expired",
  "inactive",
];

type FilterKey = "status" | "mode" | "tag" | "plan" | "ptype" | "month";

interface ActiveFilter {
  key: FilterKey | "search";
  label: string;
  value: string;
}

function activeSelectClass(isActive: boolean) {
  return isActive
    ? "border-primary/50 bg-primary/5 text-primary font-medium"
    : "";
}

export default function WellnessMembers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<WellnessStatus | "all">(
    (searchParams.get("status") as WellnessStatus | "all") ?? "all",
  );
  const [mode, setMode] = useState<MemberModeFilter>((searchParams.get("mode") as MemberModeFilter) ?? "all");
  const [tag, setTag] = useState<string>(searchParams.get("tag") ?? "all");
  const [planF, setPlanF] = useState<string>(searchParams.get("plan") ?? "all");
  const [typeF, setTypeF] = useState<string>(searchParams.get("ptype") ?? "all");
  const [monthF, setMonthF] = useState<string>(searchParams.get("month") ?? "all");
  const planFilterOn = planF !== "all" || typeF !== "all" || monthF !== "all";
  const { data: planIndex, isLoading: planLoading } = useMemberPlanIndex(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WellnessMember | null>(null);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatus(s as WellnessStatus | "all");
    const m = searchParams.get("mode");
    if (m) setMode(m as MemberModeFilter);
    const t = searchParams.get("tag");
    if (t) setTag(t);
  }, [searchParams]);

  const syncParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (!value || value === "all") p.delete(key);
    else p.set(key, value);
    setSearchParams(p, { replace: true });
  };

  const { data: allMembers, isLoading: membersLoading } = useWellnessMembers(search, status, "all", mode, tag);
  const matchedEvents = new Map<string, PlanEvent[]>();
  if (planFilterOn && planIndex) {
    for (const e of planIndex.events) {
      if (!eventMatches(e, planF, typeF, monthF)) continue;
      matchedEvents.set(e.memberId, [...(matchedEvents.get(e.memberId) ?? []), e]);
    }
  }
  const members = planFilterOn ? allMembers?.filter((m) => matchedEvents.has(m.id)) : allMembers;
  const isLoading = membersLoading || (planFilterOn && planLoading);
  const months = monthOptions();

  const exportPlanXlsx = () => {
    const rows: (string | number)[][] = [["Name", "Mobile", "Status", "Mode", "Tags", "Plan", "Type", "Date", "Amount (₹)", "Servings left"]];
    for (const m of members ?? []) {
      for (const e of matchedEvents.get(m.id) ?? []) {
        rows.push([m.full_name, m.mobile_number, statusLabel(m.status), modeLabel(m.member_mode), (m.tags ?? []).map(tagLabel).join(" | "),
          e.planName, e.type === "new" ? "New" : e.type === "renewal" ? "Renewal" : "Trial", formatDate(e.date), e.amount ?? "", e.remaining ?? ""]);
      }
    }
    downloadXlsx(`members-by-plan-${todayIst()}.xlsx`, "Members", rows, [24, 14, 14, 10, 20, 28, 10, 14, 12, 12]);
  };
  const { data: referralCounts } = useReferralCounts();

  const planLabels: Record<string, string> = { gold: "Gold Card UMS (30)", white: "White Card (15)", paid_trial: "Paid trials", free_trial: "Free / guest trials" };
  const typeLabels: Record<string, string> = { new: "New", renewal: "Renewal", trial: "Trial" };

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (search.trim()) list.push({ key: "search", label: `"${search.trim()}"`, value: search });
    if (status !== "all") list.push({ key: "status", label: statusLabel(status as WellnessStatus), value: status });
    if (mode !== "all") list.push({ key: "mode", label: modeLabel(mode), value: mode });
    if (tag !== "all") list.push({ key: "tag", label: tagLabel(tag), value: tag });
    if (planF !== "all") list.push({ key: "plan", label: planLabels[planF] ?? planIndex?.plans.find((p) => `plan:${p.id}` === planF)?.name ?? planF, value: planF });
    if (typeF !== "all") list.push({ key: "ptype", label: typeLabels[typeF] ?? typeF, value: typeF });
    if (monthF !== "all") { const mo = months.find((m) => m.value === monthF); list.push({ key: "month", label: mo?.label ?? monthF, value: monthF }); }
    return list;
  }, [search, status, mode, tag, planF, typeF, monthF, planIndex, months]);

  const hasActiveFilters = activeFilters.length > 0;

  const dismissFilter = (f: ActiveFilter) => {
    switch (f.key) {
      case "search":
        setSearch("");
        syncParam("q", "");
        break;
      case "status":
        setStatus("all");
        syncParam("status", "all");
        break;
      case "mode":
        setMode("all");
        syncParam("mode", "all");
        break;
      case "tag":
        setTag("all");
        syncParam("tag", "all");
        break;
      case "plan":
        setPlanF("all");
        syncParam("plan", "all");
        break;
      case "ptype":
        setTypeF("all");
        syncParam("ptype", "all");
        break;
      case "month":
        setMonthF("all");
        syncParam("month", "all");
        break;
    }
  };

  const clearAll = () => {
    setSearch("");
    setStatus("all");
    setMode("all");
    setTag("all");
    setPlanF("all");
    setTypeF("all");
    setMonthF("all");
    setSearchParams({}, { replace: true });
  };

  const exportCsv = () => {
    const rows = members ?? [];
    const headers = [
      "Name","Mobile","Email","Status","Mode","Tags","Goal","Batch","Joined","Initial weight (kg)","Current weight (kg)","Target weight (kg)","People helped","Frontline","Cluster","Network total","Master level",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((m) =>
        [
          m.full_name,
          m.mobile_number,
          m.email ?? "",
          statusLabel(m.status),
          modeLabel(m.member_mode),
          (m.tags ?? []).map(tagLabel).join(" | "),
          m.goal ?? "",
          m.wellness_batches?.name ?? "",
          m.joining_date,
          m.initial_weight ?? "",
          m.current_weight ?? "",
          m.target_weight ?? "",
          referralCounts?.[m.id] ?? 0,
          m.frontline_count ?? 0,
          m.cluster_count ?? 0,
          m.network_total ?? 0,
          (m.master_level ?? 0) > 0 ? `Master ${m.master_level}` : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wellness-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Members" description="Every wellness member, from first enquiry to renewal.">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {planFilterOn && (
            <Button variant="secondary" className="w-full sm:w-auto" onClick={exportPlanXlsx} disabled={!members?.length}>
              <Download className="mr-2 h-4 w-4" /> Export plan list (Excel)
            </Button>
          )}
          <Button variant="secondary" className="w-full sm:w-auto" onClick={exportCsv} disabled={!members?.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add member
          </Button>
        </div>
      </PageBanner>

      <MissingLoginsBanner />

      {/* Filter container */}
      <Card className="space-y-3.5 border-border/60 p-4 shadow-sm">
        {/* Top row: search + count + clear */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search by name, mobile, email or code"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                syncParam("q", e.target.value);
              }}
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  syncParam("q", "");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isLoading && members && (
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
            )}
            {hasActiveFilters && (
              <>
                <Badge variant="secondary" className="whitespace-nowrap tabular-nums">
                  {activeFilters.length} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={clearAll}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as WellnessStatus | "all");
              syncParam("status", v);
            }}
          >
            <SelectTrigger className={activeSelectClass(status !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : statusLabel(s as WellnessStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={mode}
            onValueChange={(v) => {
              setMode(v as MemberModeFilter);
              syncParam("mode", v);
            }}
          >
            <SelectTrigger className={activeSelectClass(mode !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="physical">Physical</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={tag}
            onValueChange={(v) => {
              setTag(v);
              syncParam("tag", v);
            }}
          >
            <SelectTrigger className={activeSelectClass(tag !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {MEMBER_TAGS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={planF} onValueChange={(v) => { setPlanF(v); syncParam("plan", v); }}>
            <SelectTrigger className={activeSelectClass(planF !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any plan</SelectItem>
              <SelectItem value="gold">Gold Card UMS (30)</SelectItem>
              <SelectItem value="white">White Card (15)</SelectItem>
              <SelectItem value="paid_trial">Paid trials</SelectItem>
              <SelectItem value="free_trial">Free / guest trials</SelectItem>
              {planIndex?.plans.map((p) => <SelectItem key={p.id} value={`plan:${p.id}`}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={typeF} onValueChange={(v) => { setTypeF(v); syncParam("ptype", v); }}>
            <SelectTrigger className={activeSelectClass(typeF !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">New, renewal & trial</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="renewal">Renewal</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
            </SelectContent>
          </Select>

          <Select value={monthF} onValueChange={(v) => { setMonthF(v); syncParam("month", v); }}>
            <SelectTrigger className={activeSelectClass(monthF !== "all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              {months.map((mo, i) => <SelectItem key={mo.value} value={mo.value}>{i === 0 ? `This month (${mo.label})` : i === 1 ? `Last month (${mo.label})` : mo.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                onClick={() => dismissFilter(f)}
              >
                <span className="text-primary/60">
                  {f.key === "search" ? "Search" : f.key === "status" ? "Status" : f.key === "mode" ? "Mode" : f.key === "tag" ? "Tag" : f.key === "plan" ? "Plan" : f.key === "ptype" ? "Type" : "Month"}:
                </span>
                {f.label}
                <X className="h-3 w-3 text-primary/50" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Member list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : members?.length ? (
        <div className="space-y-2">
          {members.map((m) => (
            <WellnessListRow
              key={m.id}
              onClick={() => setSelected(m)}
              title={m.full_name}
              meta={`${m.mobile_number} · Joined ${formatDate(m.joining_date)}`}
              badges={
                <>
                  <ModeBadge mode={m.member_mode} />
                  {!m.user_id && m.status !== "lead" && (
                    <Badge variant="outline" className="gap-1 text-destructive">
                      <KeyRound className="h-3 w-3" /> No login
                    </Badge>
                  )}
                  <TagBadges tags={m.tags} />
                  <PinkCardBadge balance={m.pink_card_balance} />
                  <MasterTitleBadge level={m.master_level} size="sm" />
                  {m.wellness_batches?.name && <Badge variant="outline">{m.wellness_batches.name}</Badge>}
                  {!!referralCounts?.[m.id] && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {referralCounts[m.id]}
                    </Badge>
                  )}
                  {m.current_weight && <span className="text-sm text-muted-foreground">{m.current_weight} kg</span>}
                  <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-4 py-16">
          <div className="rounded-full bg-muted p-3">
            <SearchX className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No members match your current filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try broadening your search or clearing some filters.</p>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearAll} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Clear all filters
            </Button>
          )}
        </Card>
      )}

      <CreateMemberDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MemberDetailSheet member={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
