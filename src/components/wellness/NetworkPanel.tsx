import { useMemo, useState } from "react";
import {
  getMasterTitle,
  getNextMasterLevel,
  NetworkMember,
  useReferralNetwork,
  WellnessStatus,
} from "@/hooks/useWellness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { statusLabel, statusVariant } from "@/components/wellness/status";
import { MasterIcons } from "@/components/wellness/MasterTitleBadge";
import { Users } from "lucide-react";

function levelFromTotal(total: number): number {
  const title = getMasterTitle(total);
  return title ? Number(title.replace("Master ", "")) : 0;
}

export function MasterTitleCard({
  frontline,
  cluster,
  total,
  compact,
}: {
  frontline: number;
  cluster: number;
  total: number;
  compact?: boolean;
}) {
  const level = levelFromTotal(total);
  const next = getNextMasterLevel(total);
  const prev = level;
  const pct = next
    ? Math.max(0, Math.min(100, Math.round(((total - prev) / (next.level - prev)) * 100)))
    : 100;

  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      {level > 0 ? (
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <MasterIcons level={level} className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Master {level}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Master title yet — 10 network members needed for Master 10.
        </p>
      )}

      <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 gap-3"}>
        {[
          { label: "Frontline", value: frontline },
          { label: "Cluster", value: cluster },
          { label: "Total", value: total },
        ].map((t) => (
          <div key={t.label} className="rounded-md border bg-background p-3 text-center">
            <p className="text-lg font-semibold">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {next
            ? `Next level: Master ${next.level} — ${next.remaining} more needed`
            : "Highest Master level reached."}
        </p>
        <Progress value={pct} className="h-2 [&>div]:bg-amber-500 dark:[&>div]:bg-amber-400" />
      </div>
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
  const { data: network, isLoading } = useReferralNetwork(memberId);
  const [view, setView] = useState<"tree" | "list">("tree");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => network ?? [], [network]);
  const frontline = rows.filter((r) => r.depth === 1);
  const total = rows.length;

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
        <MasterTitleCard frontline={frontline.length} cluster={total - frontline.length} total={total} />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading network…</p>
      ) : !total ? (
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
