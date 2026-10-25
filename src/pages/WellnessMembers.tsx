import { useEffect, useState } from "react";
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
import { Download, KeyRound, Plus, Search, Users } from "lucide-react";

const STATUSES: (WellnessStatus | "all")[] = [
  "all",
  "lead",
  "trial",
  "active_member",
  "renewal_due",
  "expired",
  "inactive",
];

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

  // follow deep links from the dashboard
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


      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 sm:min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, mobile, email or activation code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as WellnessStatus | "all");
            syncParam("status", v);
          }}
        >
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {MEMBER_TAGS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planF} onValueChange={(v) => { setPlanF(v); syncParam("plan", v); }}>
          <SelectTrigger className="sm:w-52" aria-label="Plan"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="sm:w-36" aria-label="Plan type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">New, renewal & trial</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="renewal">Renewal</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthF} onValueChange={(v) => { setMonthF(v); syncParam("month", v); }}>
          <SelectTrigger className="sm:w-44" aria-label="Month"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any time</SelectItem>
            {months.map((m, i) => <SelectItem key={m.value} value={m.value}>{i === 0 ? `This month (${m.label})` : i === 1 ? `Last month (${m.label})` : m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {planFilterOn && !isLoading && (
        <p className="text-sm text-muted-foreground">{members?.length ?? 0} people match this plan filter.</p>
      )}

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
        <p className="py-16 text-center text-muted-foreground">No members match this view yet.</p>
      )}

      <CreateMemberDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MemberDetailSheet member={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
