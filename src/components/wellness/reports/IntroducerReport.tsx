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

type Kind = "coach" | "member" | "outside" | "none";
interface Row {
  member_id: string; full_name: string; mobile_number: string; joined_on: string; status: string;
  current_plan: string | null; introducer_id: string | null; introducer_name: string | null;
  introducer_mobile: string | null; introducer_kind: Kind;
}

const ist = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const KIND_LABEL: Record<Kind, string> = { coach: "Coach", member: "Club member", outside: "Outside", none: "Not recorded" };

function planBucket(p: string | null): "paid_trial" | "white" | "gold" | null {
  if (!p) return null;
  const n = p.toLowerCase();
  if (n.includes("gold") || n.includes("ums")) return "gold";
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
  const [open, setOpen] = useState<string | null>(null);

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
  const selected = groups.find((g) => g.key === open);

  const exportAll = () => {
    downloadXlsx(`introducers-${from}-to-${to}.xlsx`, "Who introduced whom", [
      ["New person", "Mobile", "Joined", "Current plan", "Introduced by", "Introducer mobile", "Introducer type"],
      ...rows.map((r) => [r.full_name, r.mobile_number, formatDate(r.joined_on), r.current_plan ?? "", r.introducer_name ?? "", r.introducer_mobile ?? "", KIND_LABEL[r.introducer_kind]]),
    ], [24, 14, 14, 26, 24, 16, 16]);
  };

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
            {[
              ["New people", rows.length],
              ["By coaches", count("coach")],
              ["By club members", count("member")],
              ["By outside people", count("outside")],
              ["Not recorded", count("none")],
            ].map(([label, n]) => (
              <Card key={label as string}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{n}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Introduced by</th><th className="p-3">Type</th>
                  <th className="p-3 text-right">Introduced</th><th className="p-3 text-right">Paid trial</th>
                  <th className="p-3 text-right">White Card</th><th className="p-3 text-right">Gold UMS</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const b = (k: string) => g.people.filter((p) => planBucket(p.current_plan) === k).length;
                  return (
                    <tr key={g.key} className="cursor-pointer border-b hover:bg-accent/40" onClick={() => setOpen(g.key)}>
                      <td className="p-3 font-medium">{g.name}{g.mobile ? <span className="ml-2 text-xs text-muted-foreground">{g.mobile}</span> : null}</td>
                      <td className="p-3"><Badge variant={g.kind === "coach" ? "default" : "secondary"}>{KIND_LABEL[g.kind]}</Badge></td>
                      <td className="p-3 text-right font-semibold">{g.people.length}</td>
                      <td className="p-3 text-right">{b("paid_trial")}</td>
                      <td className="p-3 text-right">{b("white")}</td>
                      <td className="p-3 text-right">{b("gold")}</td>
                    </tr>
                  );
                })}
                {!groups.length && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No introducers recorded in this period.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent></Card>
        </>
      )}

      <ResponsiveDialog
        open={!!selected}
        onOpenChange={(o) => !o && setOpen(null)}
        title={selected ? `Introduced by ${selected.name}` : ""}
        description={selected ? `${selected.people.length} people · ${KIND_LABEL[selected.kind]}` : ""}
      >
        <ul className="divide-y text-sm">
          {selected?.people.map((p) => (
            <li key={p.member_id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <a className="font-medium underline-offset-2 hover:underline" href={`/wellness/members?member=${p.member_id}`}>{p.full_name}</a>
                <p className="text-xs text-muted-foreground">{p.mobile_number} · joined {formatDate(p.joined_on)}</p>
              </div>
              <Badge variant="outline">{p.current_plan ?? p.status}</Badge>
            </li>
          ))}
        </ul>
      </ResponsiveDialog>
    </div>
  );
}
