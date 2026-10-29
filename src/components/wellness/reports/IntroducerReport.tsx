import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Download, Loader2 } from "lucide-react";
import { downloadXlsx } from "@/lib/reportExport";
import { formatDate } from "@/lib/formatters";
import { IntroducerEditor } from "@/components/wellness/IntroducerEditor";

type Kind = "coach" | "member" | "outside" | "none";
interface Row {
  member_id: string; full_name: string; mobile_number: string; joined_on: string; status: string;
  current_plan: string | null; introducer_id: string | null; introducer_name: string | null;
  introducer_mobile: string | null; introducer_kind: Kind; gold_type?: "new" | "renewal" | null;
}

const ist = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const KIND_LABEL: Record<Kind, string> = { coach: "Coach", member: "Club member", outside: "Outside", none: "Not recorded" };

export function planBucket(p: string | null, goldType?: string | null): "paid_trial" | "white" | "gold_new" | "gold_renewal" | null {
  if (!p) return null;
  const n = p.toLowerCase();
  if (n.includes("gold") || n.includes("ums")) return goldType === "renewal" ? "gold_renewal" : "gold_new";
  if (n.includes("white") || n.includes("15 visit")) return "white";
  if (n.includes("paid") || n.includes("3 days renewal")) return "paid_trial";
  return null;
}

export function IntroducerReport() {
  const now = new Date();
  const today = ist(now);
  const monthStart = today.slice(0, 8) + "01";
  const lm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lmStart = lm.toISOString().slice(0, 10);
  const lmEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const { data, isLoading, error } = useQuery({
    queryKey: ["introducer-report", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_introducer_report" as never, { _from: from, _to: to } as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = data ?? [];
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; mobile: string | null; kind: Kind; people: Row[] }>();
    for (const r of rows) {
      if (r.introducer_kind === "none") continue;
      const key = r.introducer_id ?? `out:${(r.introducer_name ?? "").toLowerCase().trim()}`;
      const g = m.get(key) ?? { key, name: r.introducer_name ?? "—", mobile: r.introducer_mobile, kind: r.introducer_kind, people: [] };
      g.people.push(r);
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.people.length - a.people.length);
  }, [rows]);

  const count = (k: Kind) => rows.filter((r) => r.introducer_kind === k).length;
  const [drill, setDrill] = useState<{ title: string; people: Row[] } | null>(null);
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  // keep drill list fresh after edits
  const drillPeople = useMemo(() => {
    if (!drill) return [];
    const ids = new Set(drill.people.map((p) => p.member_id));
    const fresh = rows.filter((r) => ids.has(r.member_id));
    const list = drill.title === "Not recorded" ? fresh.filter((r) => r.introducer_kind === "none").concat(fresh.filter((r) => r.introducer_kind !== "none")) : fresh;
    const s = q.toLowerCase().trim();
    return s ? list.filter((p) => p.full_name.toLowerCase().includes(s) || p.mobile_number?.includes(s)) : list;
  }, [drill, rows, q]);
  const openDrill = (title: string, people: Row[]) => { if (people.length) { setQ(""); setEditId(null); setDrill({ title, people }); } };
  const NumBtn = ({ n, title, people, bold }: { n: number; title: string; people: Row[]; bold?: boolean }) =>
    n ? (
      <button type="button" className={`text-primary underline underline-offset-2 hover:opacity-80 ${bold ? "font-semibold" : ""}`} onClick={(e) => { e.stopPropagation(); openDrill(title, people); }}>{n}</button>
    ) : <span className="text-muted-foreground">0</span>;

  const exportList = () => {
    if (!drill) return;
    downloadXlsx(`${drill.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${from}-to-${to}.xlsx`, "People", [
      ["Name", "Mobile", "Joined", "Current plan", "Gold UMS type", "Status", "Introduced by", "Introducer mobile", "Type"],
      ...drillPeople.map((r) => [r.full_name, r.mobile_number, formatDate(r.joined_on), r.current_plan ?? "", r.gold_type === "renewal" ? "Renewal" : r.gold_type === "new" ? "New" : "", r.status, r.introducer_name ?? "", r.introducer_mobile ?? "", KIND_LABEL[r.introducer_kind]]),
    ], [24, 14, 14, 26, 14, 24, 16, 16]);
  };

  const exportAll = () => {
    downloadXlsx(`introducers-${from}-to-${to}.xlsx`, "Who introduced whom", [
      ["New person", "Mobile", "Joined", "Current plan", "Gold UMS type", "Introduced by", "Introducer mobile", "Introducer type"],
      ...rows.map((r) => [r.full_name, r.mobile_number, formatDate(r.joined_on), r.current_plan ?? "", r.gold_type === "renewal" ? "Renewal" : r.gold_type === "new" ? "New" : "", r.introducer_name ?? "", r.introducer_mobile ?? "", KIND_LABEL[r.introducer_kind]]),
    ], [24, 14, 14, 26, 24, 16, 16]);
  };

  const tiles: [string, Row[]][] = [
    ["New people", rows],
    ["By coaches", rows.filter((r) => r.introducer_kind === "coach")],
    ["By club members", rows.filter((r) => r.introducer_kind === "member")],
    ["By outside people", rows.filter((r) => r.introducer_kind === "outside")],
    ["Not recorded", rows.filter((r) => r.introducer_kind === "none")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="outline" onClick={() => { setFrom(today); setTo(today); }}>Today</Button>
        <Button size="sm" variant="outline" onClick={() => { setFrom(monthStart); setTo(today); }}>This month</Button>
        <Button size="sm" variant="outline" onClick={() => { setFrom(lmStart); setTo(lmEnd); }}>Last month</Button>
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button size="sm" onClick={exportAll} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Excel</Button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Could not load the report: {(error as Error).message}</p>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            {tiles.map(([label, people]) => (
              <Card key={label} className={people.length ? "cursor-pointer transition hover:border-primary hover:shadow-sm" : ""} onClick={() => openDrill(label, people)}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{people.length}</p>
                  {people.length ? <p className="text-[11px] text-primary">Tap to see list</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Introduced by</th><th className="p-3">Type</th>
                  <th className="p-3 text-right">Introduced</th><th className="p-3 text-right">Paid trial</th>
                  <th className="p-3 text-right">White Card</th><th className="p-3 text-right">New Gold UMS</th><th className="p-3 text-right">Renewal Gold UMS</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const b = (k: string) => g.people.filter((p) => planBucket(p.current_plan, p.gold_type) === k);
                  return (
                    <tr key={g.key} className="cursor-pointer border-b hover:bg-accent/40" onClick={() => openDrill(`Introduced by ${g.name}`, g.people)}>
                      <td className="p-3 font-medium">{g.name}{g.mobile ? <span className="ml-2 text-xs text-muted-foreground">{g.mobile}</span> : null}</td>
                      <td className="p-3"><Badge variant={g.kind === "coach" ? "default" : "secondary"}>{KIND_LABEL[g.kind]}</Badge></td>
                      <td className="p-3 text-right"><NumBtn bold n={g.people.length} title={`Introduced by ${g.name}`} people={g.people} /></td>
                      <td className="p-3 text-right"><NumBtn n={b("paid_trial").length} title={`${g.name} · Paid trial`} people={b("paid_trial")} /></td>
                      <td className="p-3 text-right"><NumBtn n={b("white").length} title={`${g.name} · White Card`} people={b("white")} /></td>
                      <td className="p-3 text-right"><NumBtn n={b("gold_new").length} title={`${g.name} · New Gold UMS`} people={b("gold_new")} /></td>
                      <td className="p-3 text-right"><NumBtn n={b("gold_renewal").length} title={`${g.name} · Renewal Gold UMS`} people={b("gold_renewal")} /></td>
                    </tr>
                  );
                })}
                {!groups.length && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No introducers recorded in this period.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent></Card>
        </>
      )}

      <ResponsiveDialog
        open={!!drill}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.title ?? ""}
        description={drill ? `${drillPeople.length} people · ${formatDate(from)} to ${formatDate(to)}` : ""}
      >
        <div className="mb-3 flex gap-2">
          <Input placeholder="Search name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" variant="outline" onClick={exportList} disabled={!drillPeople.length}><Download className="mr-1 h-4 w-4" />Excel</Button>
        </div>
        <ul className="divide-y text-sm">
          {drillPeople.map((p) => (
            <li key={p.member_id} className="py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a className="font-medium text-primary underline-offset-2 hover:underline" href={`/members?q=${p.mobile_number}`}>{p.full_name}</a>
                  <p className="text-xs text-muted-foreground">{p.mobile_number} · joined {formatDate(p.joined_on)} · {p.status}</p>
                  <p className="text-xs text-muted-foreground">
                    Introduced by: {p.introducer_kind === "none" ? <span className="text-destructive">Not recorded</span> : `${p.introducer_name ?? "—"}${p.introducer_mobile ? ` · ${p.introducer_mobile}` : ""} (${KIND_LABEL[p.introducer_kind]})`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline">{p.current_plan ?? "No plan"}{p.gold_type ? ` · ${p.gold_type === "renewal" ? "Renewal" : "New"}` : ""}</Badge>
                  {p.introducer_kind === "none" && (
                    <Button size="sm" variant="secondary" onClick={() => setEditId(editId === p.member_id ? null : p.member_id)}>
                      {editId === p.member_id ? "Close" : "Set introducer"}
                    </Button>
                  )}
                </div>
              </div>
              {editId === p.member_id && (
                <div className="mt-2 rounded-md border p-3">
                  <IntroducerEditor member={{ id: p.member_id, referred_by_member_id: null, referrer_name: null, referrer_mobile: null }} />
                </div>
              )}
            </li>
          ))}
          {!drillPeople.length && <li className="py-6 text-center text-muted-foreground">No people found.</li>}
        </ul>
      </ResponsiveDialog>
    </div>
  );
}
