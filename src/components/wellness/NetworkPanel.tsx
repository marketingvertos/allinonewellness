import { useMemo, useState } from "react";
import {
  getMasterTitle,
  getNextMasterLevel,
  NetworkMember,
  SupervisorStatus,
  useMemberNetwork,
  useSupervisorStatus,
  WellnessStatus,
} from "@/hooks/useWellness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { statusLabel, statusVariant } from "@/components/wellness/status";
import { MasterIcons } from "@/components/wellness/MasterTitleBadge";
import { Users, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NetworkDetailRow } from "@/components/wellness/NetworkDetailRow";

function levelFromTotal(total: number): number {
  const title = getMasterTitle(total);
  return title ? Number(title.replace("Master ", "")) : 0;
}

function RuleRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}

export function MasterTitleCard({
  frontline,
  cluster,
  total,
  compact,
  isSupervisor = true,
  status,
  members,
  onOpenMember,
}: {
  frontline: number;
  cluster: number;
  total: number;
  compact?: boolean;
  isSupervisor?: boolean;
  status?: SupervisorStatus | null;
  members?: NetworkMember[];
  onOpenMember?: (id: string) => void;
}) {
  const qualified = status ? status.is_qualified : isSupervisor;
  const level = isSupervisor && qualified ? levelFromTotal(total) : 0;
  const next = getNextMasterLevel(total);
  const prev = levelFromTotal(total);
  const pct = next
    ? Math.max(0, Math.min(100, Math.round(((total - prev) / (next.level - prev)) * 100)))
    : 100;
  const newFrontline = status?.new_frontline_count ?? 0;
  const required = status?.new_frontline_required ?? 2;
  const [openList, setOpenList] = useState<null | "frontline" | "cluster" | "total">(null);
  const [listFilter, setListFilter] = useState<"all" | "counted">("all");

  const all = useMemo(() => members ?? [], [members]);
  const byGroup = useMemo(() => {
    if (openList === "frontline") return all.filter((m) => m.depth === 1);
    if (openList === "cluster") return all.filter((m) => m.depth > 1);
    return all;
  }, [all, openList]);
  const countedInGroup = useMemo(
    () => byGroup.filter((m) => m.qualifies_this_month !== false),
    [byGroup],
  );
  const listMembers = listFilter === "counted" ? countedInGroup : byGroup;
  const listTitle =
    openList === "frontline" ? "My Frontline" : openList === "cluster" ? "My Cluster" : "My Network";
  const nameById = useMemo(
    () => Object.fromEntries(all.map((m) => [m.member_id, { name: m.full_name, parent: m.referred_by }])),
    [all],
  );


  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      {!isSupervisor ? (
        <p className="text-sm text-muted-foreground">
          Master titles are for Supervisors. Once tagged as Supervisor, this network qualifies for Master titles.
        </p>
      ) : level > 0 ? (
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <MasterIcons level={level} className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Master {level}</span>
        </div>
      ) : status && !status.is_qualified ? (
        <p className="text-sm font-medium text-destructive">
          Title on hold this month — complete the steps below to keep your Master title.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Master title yet — 10 network members needed for Master 10.
        </p>
      )}

      <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 gap-3"}>
        {([
          { label: "Frontline", value: frontline, key: "frontline" as const },
          { label: "Cluster", value: cluster, key: "cluster" as const },
          { label: "Total", value: total, key: "total" as const },
        ]).map((t) =>
          members ? (
            <button
              key={t.label}
              type="button"
              onClick={() => setOpenList(t.key)}
              className="rounded-md border bg-background p-3 text-center transition-colors hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <p className="text-lg font-semibold">{t.value}</p>
              <p className="text-xs text-muted-foreground underline-offset-2 hover:underline">{t.label}</p>
            </button>
          ) : (
            <div key={t.label} className="rounded-md border bg-background p-3 text-center">
              <p className="text-lg font-semibold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ),
        )}
      </div>

      <Dialog open={openList !== null} onOpenChange={(o) => !o && setOpenList(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {listTitle} ({listMembers.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={listFilter === "all" ? "default" : "outline"}
                onClick={() => setListFilter("all")}
              >
                All ({byGroup.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listFilter === "counted" ? "default" : "outline"}
                onClick={() => setListFilter("counted")}
              >
                Counted this month ({countedInGroup.length})
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Counted members are on a UMS 30 plan, new or renewed this month. Frontline counts for Master &amp; Ambassador; cluster counts for Master only.
            </p>
            {(openList === "frontline" ? [1] : [...new Set(listMembers.map((m) => m.depth))].sort((x, y) => x - y)).map((d) => {
              const atDepth = listMembers.filter((m) => m.depth === d);
              if (!atDepth.length) return null;
              const rowsEl = atDepth.map((m) => (
                <NetworkDetailRow
                  key={m.member_id}
                  m={m}
                  nameById={nameById}
                  onOpen={
                    onOpenMember
                      ? (id) => {
                          setOpenList(null);
                          onOpenMember(id);
                        }
                      : undefined
                  }
                />
              ));
              if (openList === "frontline") return <div key={d} className="space-y-2">{rowsEl}</div>;
              return (
                <details key={d} open={d === 1} className="rounded-md border">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
                    {d === 1 ? "My Frontline" : `Level ${d - 1}${d === 2 ? " (referred by your frontline)" : ""}`} ({atDepth.length})
                  </summary>
                  <div className="space-y-2 p-2 pt-0">{rowsEl}</div>
                </details>
              );
            })}
            {!listMembers.length && (
              <p className="text-sm text-muted-foreground">No members in this list.</p>
            )}
          </div>

        </DialogContent>
      </Dialog>
      {isSupervisor && (
        <>
          <p className="text-xs text-muted-foreground">
            Counts only members who joined or renewed a UMS 30 membership this calendar month. Trials,
            10-day / 15-visit plans, renewals due and expired members are not counted.
          </p>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {next
                ? `Next level: Master ${next.level} — ${next.remaining} more needed`
                : "Highest Master level reached."}
            </p>
            <Progress value={pct} className="h-2 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-400" />
          </div>
        </>
      )}


      {isSupervisor && status && (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <p className="text-sm font-semibold">This month's title check</p>
          <RuleRow ok={status.self_renewed} text="Own membership taken or renewed this month" />
          <div className="space-y-1">
            <RuleRow
              ok={newFrontline >= required}
              text={`${newFrontline} of ${required} new frontline members added this month`}
            />
            <Progress
              value={Math.min(100, Math.round((newFrontline / required) * 100))}
              className="h-2 [&>div]:bg-emerald-500 dark:[&>div]:bg-emerald-400"
            />
          </div>
          <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to keep your Master title</p>
            <p>1. Renew your own UMS 30 membership every calendar month.</p>
            <p>2. Add at least {required} new UMS 30 members to your frontline every calendar month.</p>
            <p>3. Only members who join or renew a UMS 30 plan in the month count in your network.</p>
            <p>4. Miss a step and the title is paused until the month's targets are met.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  m,
  downstream,
  onOpen,
}: {
  m: NetworkMember;
  downstream?: number;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      {onOpen ? (
        <button className="truncate text-left font-medium hover:underline" onClick={() => onOpen(m.member_id)}>
          {m.full_name}
        </button>
      ) : (
        <span className="truncate font-medium">{m.full_name}</span>
      )}
      <span className="flex shrink-0 items-center gap-2">
        {m.qualifies_this_month != null && (
          <Badge variant={m.qualifies_this_month ? "default" : "outline"}>
            {m.qualifies_this_month ? "Counted" : "Not counted"}
          </Badge>
        )}
        <Badge variant={statusVariant(m.status as WellnessStatus)}>
          {statusLabel(m.status as WellnessStatus)}
        </Badge>
        {downstream != null && downstream > 0 && (
          <span className="text-xs text-muted-foreground">{downstream} downstream</span>
        )}
      </span>
    </div>
  );
}


export function NetworkPanel({
  memberId,
  onOpenMember,
  showTitleCard = true,
}: {
  memberId: string;
  onOpenMember?: (id: string) => void;
  showTitleCard?: boolean;
}) {
  const { data: network, isLoading } = useMemberNetwork(memberId);
  const { data: supervisorStatus } = useSupervisorStatus(memberId);
  const { data: isSupervisor } = useQuery({
    queryKey: ["member-supervisor", memberId],
    queryFn: async () => {
      const { data } = await supabase.from("wellness_members").select("tags").eq("id", memberId).maybeSingle();
      return (data?.tags ?? []).includes("supervisor");
    },
  });
  const [view, setView] = useState<"tree" | "list">("tree");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => network ?? [], [network]);
  const counted = rows.filter((r) => r.qualifies_this_month !== false);
  const frontline = counted.filter((r) => r.depth === 1);
  const total = counted.length;


  const nameById = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.member_id, r.full_name])),
    [rows],
  );

  const downstreamCount = useMemo(() => {
    const children: Record<string, string[]> = {};
    for (const r of rows) {
      if (!r.referred_by) continue;
      (children[r.referred_by] ??= []).push(r.member_id);
    }
    const count = (id: string, guard = 0): number => {
      if (guard > 20) return 0;
      const kids = children[id] ?? [];
      return kids.reduce((sum, k) => sum + 1 + count(k, guard + 1), 0);
    };
    return Object.fromEntries(rows.map((r) => [r.member_id, count(r.member_id)]));
  }, [rows]);

  const depths = useMemo(() => [...new Set(rows.map((r) => r.depth))].sort((a, b) => a - b), [rows]);

  const filtered = rows.filter((r) => r.full_name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      {showTitleCard && (
        <MasterTitleCard
          frontline={frontline.length}
          cluster={total - frontline.length}
          total={total}
          isSupervisor={!!isSupervisor}
          status={supervisorStatus}
          members={rows}
          onOpenMember={onOpenMember}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading network…</p>
      ) : !rows.length ? (

        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No one in this network yet. Referrals appear here as soon as they join.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={view === "tree" ? "default" : "outline"} onClick={() => setView("tree")}>
                Tree
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
                List
              </Button>
            </div>
            {view === "list" && (
              <Input
                placeholder="Search network"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full sm:w-56"
              />
            )}
          </div>

          {view === "tree" ? (
            <div className="space-y-4">
              {depths.map((d) => {
                const atDepth = rows.filter((r) => r.depth === d);
                const groups = atDepth.reduce<Record<string, NetworkMember[]>>((acc, r) => {
                  const key = r.referred_by ?? "";
                  (acc[key] ??= []).push(r);
                  return acc;
                }, {});
                return (
                  <Card key={d}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {d === 1 ? "Frontline" : `Level ${d}`} ({atDepth.length}{" "}
                        {atDepth.length === 1 ? "member" : "members"})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(groups).map(([parent, members]) => (
                        <div key={parent || "root"} className="space-y-2">
                          {d > 1 && (
                            <p className="text-xs text-muted-foreground">
                              Referred by {nameById[parent] ?? "this member"}
                            </p>
                          )}
                          {members.map((m) => (
                            <MemberRow
                              key={m.member_id}
                              m={m}
                              downstream={d === 1 ? downstreamCount[m.member_id] : undefined}
                              onOpen={onOpenMember}
                            />
                          ))}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => (
                <MemberRow key={m.member_id} m={m} onOpen={onOpenMember} />
              ))}
              {!filtered.length && (
                <p className="text-sm text-muted-foreground">No one matches that name.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
