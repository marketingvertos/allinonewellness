import { useState } from "react";
import { useReferralCounts, useWellnessMembers, WellnessMember, WellnessStatus } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { CreateMemberDialog } from "@/components/wellness/CreateMemberDialog";
import { MemberDetailSheet } from "@/components/wellness/MemberDetailSheet";
import { statusLabel, statusVariant } from "@/components/wellness/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WellnessStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WellnessMember | null>(null);

  const { data: members, isLoading } = useWellnessMembers(search, status);
  const { data: referralCounts } = useReferralCounts();

  const exportCsv = () => {
    const rows = members ?? [];
    const headers = [
      "Name","Mobile","Email","Status","Goal","Batch","Joined","Initial weight (kg)","Current weight (kg)","Target weight (kg)","People helped",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((m) =>
        [
          m.full_name,
          m.mobile_number,
          m.email ?? "",
          statusLabel(m.status),
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, mobile, email or activation code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as WellnessStatus | "all")}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : statusLabel(s as WellnessStatus)}
              </SelectItem>
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
            <Card
              key={m.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => setSelected(m)}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{m.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.mobile_number} · Joined {formatDate(m.joining_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.wellness_batches?.name && <Badge variant="outline">{m.wellness_batches.name}</Badge>}
                  {!!referralCounts?.[m.id] && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {referralCounts[m.id]}
                    </Badge>
                  )}
                  {m.current_weight && <span className="text-sm text-muted-foreground">{m.current_weight} kg</span>}
                  <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
                </div>
              </CardContent>
            </Card>
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
