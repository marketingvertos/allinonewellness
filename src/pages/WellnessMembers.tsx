import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MemberModeFilter, useReferralCounts, useWellnessMembers, WellnessMember, WellnessStatus } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { CreateMemberDialog } from "@/components/wellness/CreateMemberDialog";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
import { statusLabel, statusVariant } from "@/components/wellness/status";
import { MEMBER_TAGS, ModeBadge, TagBadges, modeLabel, tagLabel } from "@/components/wellness/memberMeta";
import { PinkCardBadge } from "@/components/wellness/PinkCardPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WellnessListRow } from "@/components/wellness/WellnessListRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/formatters";
import { Download, Plus, Search, Users } from "lucide-react";

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

  const { data: members, isLoading } = useWellnessMembers(search, status, "all", mode, tag);
  const { data: referralCounts } = useReferralCounts();

  const exportCsv = () => {
    const rows = members ?? [];
    const headers = [
      "Name","Mobile","Email","Status","Mode","Tags","Goal","Batch","Joined","Initial weight (kg)","Current weight (kg)","Target weight (kg)","People helped",
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
          <Button variant="secondary" className="w-full sm:w-auto" onClick={exportCsv} disabled={!members?.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add member
          </Button>
        </div>
      </PageBanner>

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
      </div>

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
                  <TagBadges tags={m.tags} />
                  <PinkCardBadge balance={m.pink_card_balance} />
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
