import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCheck, Download, Eye, Loader2, MessageCircleReply, RefreshCw, Repeat, Send, XCircle } from "lucide-react";
import { downloadXlsx } from "@/lib/reportExport";
import { failureReason, funnel, groupFailures, recipientStage, STAGE_CLASS, STAGE_LABEL, type RecipientStage } from "@/lib/broadcastStatus";
import { callBroadcast } from "@/lib/broadcastApi";

interface Rcpt {
  id: string; member_id: string | null; full_name: string | null; phone: string | null; status: string; error: string | null;
  sent_at: string | null; delivered_at: string | null; read_at: string | null; replied_at: string | null;
}

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const FILTERS: ("all" | RecipientStage)[] = ["all", "pending", "sent", "delivered", "read", "replied", "failed", "skipped"];

export default function WhatsAppBroadcastReport() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | RecipientStage>("all");
  const [q, setQ] = useState("");

  const { data: b } = useQuery({
    queryKey: ["broadcast", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_broadcasts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["broadcast-rcpts", id],
    queryFn: async () => {
      const all: Rcpt[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("whatsapp_broadcast_recipients")
          .select("id, member_id, full_name, phone, status, error, sent_at, delivered_at, read_at, replied_at")
          .eq("broadcast_id", id).order("full_name").range(from, from + 999);
        if (error) throw error;
        all.push(...((data || []) as Rcpt[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  // Live updates while sending and as receipts arrive.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) return;
      t = setTimeout(() => { t = null; qc.invalidateQueries({ queryKey: ["broadcast", id] }); qc.invalidateQueries({ queryKey: ["broadcast-rcpts", id] }); }, 1500);
    };
    const ch = supabase.channel(`broadcast-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_broadcasts", filter: `id=eq.${id}` }, bump)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_broadcast_recipients", filter: `broadcast_id=eq.${id}` }, bump)
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [id, qc]);

  const staged = useMemo(() => rows.map((r) => ({ ...r, stage: recipientStage(r) })), [rows]);
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: staged.length };
    for (const r of staged) c[r.stage] = (c[r.stage] || 0) + 1;
    return c;
  }, [staged]);
  const visible = staged.filter((r) => (filter === "all" || r.stage === filter) &&
    (!q || (r.full_name || "").toLowerCase().includes(q.toLowerCase()) || (r.phone || "").includes(q)));
  const failures = useMemo(() => groupFailures(staged.filter((r) => r.stage === "failed" || r.stage === "skipped")), [staged]);

  const action = useMutation({
    mutationFn: (a: string) => callBroadcast({ action: a, id }),
    onSuccess: (d, a) => {
      toast.success(a === "resend_unread" ? `Follow-up started to ${d.count} people` : a === "retry_failed" ? "Retrying failed messages" : a === "cancel_schedule" ? "Scheduled broadcast cancelled" : "Resumed");
      qc.invalidateQueries({ queryKey: ["broadcast", id] }); qc.invalidateQueries({ queryKey: ["broadcast-rcpts", id] }); qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportRows = (list: typeof visible) => downloadXlsx(
    `broadcast-${b?.template_name || id}-${filter}.xlsx`, "Recipients",
    [["Name", "Mobile", "Status", "Sent", "Delivered", "Read", "Replied", "Reason"],
      ...list.map((r) => [r.full_name || "", r.phone || "", STAGE_LABEL[r.stage], fmt(r.sent_at), fmt(r.delivered_at), fmt(r.read_at), fmt(r.replied_at),
        r.stage === "failed" || r.stage === "skipped" ? failureReason(r.error) : ""])],
    [24, 14, 12, 18, 18, 18, 18, 30],
  );

  if (!b) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const f = funnel(b);
  const done = f.sent + f.failed + f.skipped;
  const unread = staged.filter((r) => r.stage === "sent" || r.stage === "delivered").length;

  const steps = [
    { label: "Sent", value: f.sent, sub: `${f.total} total`, icon: Send },
    { label: "Delivered", value: f.delivered, sub: `${f.deliveryRate}% of sent`, icon: CheckCheck },
    { label: "Read", value: f.read, sub: `${f.readRate}% of sent`, icon: Eye },
    { label: "Replied", value: f.replied, sub: `${f.replyRate}% of sent`, icon: MessageCircleReply },
    { label: "Failed", value: f.failed, sub: `${f.failureRate}% of attempts`, icon: XCircle },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/whatsapp/broadcast" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold">{b.template_name}</h1>
          <p className="text-sm text-muted-foreground">
            Created {fmt(b.created_at)}{b.scheduled_at ? ` · Scheduled ${fmt(b.scheduled_at)}` : ""}{b.completed_at ? ` · Finished ${fmt(b.completed_at)}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={b.status === "sending" ? "animate-pulse" : ""}>{b.status}</Badge>
      </div>

      {b.status === "sending" && (
        <Card><CardContent className="space-y-2 pt-6">
          <div className="flex justify-between text-sm"><span>Sending…</span><span>{done} / {f.total}</span></div>
          <Progress value={(done / Math.max(1, f.total)) * 100} />
          <p className="text-xs text-muted-foreground">You can leave this page; sending continues on its own.</p>
        </CardContent></Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {steps.map((s) => (
          <Card key={s.label}><CardContent className="space-y-1 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className="h-4 w-4" />{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="space-y-2 pt-6">
        <p className="text-sm font-medium">Funnel</p>
        {[["Sent", f.sent], ["Delivered", f.delivered], ["Read", f.read], ["Replied", f.replied]].map(([l, v]) => (
          <div key={l as string} className="grid grid-cols-[80px_1fr_60px] items-center gap-2 text-xs">
            <span>{l}</span>
            <div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${f.total ? ((v as number) / f.total) * 100 : 0}%` }} /></div>
            <span className="text-right tabular-nums">{v as number}</span>
          </div>
        ))}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2">
        {b.status === "scheduled" && <Button variant="outline" onClick={() => action.mutate("cancel_schedule")}>Cancel scheduled send</Button>}
        {f.failed > 0 && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate("retry_failed")}><RefreshCw className="mr-2 h-4 w-4" />Retry {f.failed} failed</Button>}
        {b.status === "sending" && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate("process")}>Resume sending</Button>}
        {b.status === "completed" && unread > 0 && (
          <Button variant="outline" disabled={action.isPending} onClick={() => { if (window.confirm(`Send this message again to ${unread} people who haven't read it?`)) action.mutate("resend_unread"); }}>
            <Repeat className="mr-2 h-4 w-4" />Resend to {unread} unread
          </Button>
        )}
        <Button variant="outline" onClick={() => exportRows(staged)}><Download className="mr-2 h-4 w-4" />Excel (all)</Button>
        {filter !== "all" && <Button variant="outline" onClick={() => exportRows(visible)}><Download className="mr-2 h-4 w-4" />Excel ({STAGE_LABEL[filter]})</Button>}
      </div>

      {failures.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Why messages didn't go</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {failures.map((x) => <Badge key={x.reason} variant="outline" className="border-destructive/30 text-destructive">{x.reason}: {x.count}</Badge>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">Recipients</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((s) => (
              <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" onClick={() => setFilter(s)}>
                {s === "all" ? "All" : STAGE_LABEL[s]} <span className="ml-1 opacity-70">{stageCounts[s] || 0}</span>
              </Button>
            ))}
          </div>
          <Input placeholder="Search name or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr className="border-b text-left">
                  <th className="p-2">Name</th><th className="p-2">Mobile</th><th className="p-2">Status</th>
                  <th className="hidden p-2 md:table-cell">Sent</th><th className="hidden p-2 md:table-cell">Delivered</th><th className="hidden p-2 md:table-cell">Read</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
                {!isLoading && !visible.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No one in this group.</td></tr>}
                {visible.slice(0, 1000).map((r) => (
                  <tr key={r.id} className="border-b align-top">
                    <td className="p-2">
                      {r.member_id ? <Link className="text-primary hover:underline" to={`/members?q=${encodeURIComponent(r.full_name || "")}`}>{r.full_name || "—"}</Link> : (r.full_name || "—")}
                      {(r.stage === "failed" || r.stage === "skipped") && <div className="text-xs text-destructive">{failureReason(r.error)}</div>}
                    </td>
                    <td className="p-2 tabular-nums">{r.phone}</td>
                    <td className="p-2"><Badge variant="outline" className={STAGE_CLASS[r.stage]}>{STAGE_LABEL[r.stage]}</Badge></td>
                    <td className="hidden p-2 text-xs md:table-cell">{fmt(r.sent_at)}</td>
                    <td className="hidden p-2 text-xs md:table-cell">{fmt(r.delivered_at)}</td>
                    <td className="hidden p-2 text-xs md:table-cell">{fmt(r.read_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
