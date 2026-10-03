import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Megaphone, RefreshCw, Send } from "lucide-react";
import { useAllWhatsAppTemplates } from "@/hooks/useWhatsApp";
import { fillTemplate } from "@/components/whatsapp/TemplatePicker";

type Mapping = { source: "first_name" | "full_name" | "fixed"; value?: string };
type Audience = "active" | "expired" | "trial" | "all";

interface MemberRow {
  id: string; full_name: string; mobile_number: string; status: string;
  member_mode: string; tags: string[]; is_guest: boolean;
}

const ACTIVE = ["active_member", "renewal_due"];

function varValue(m: Mapping, name: string) {
  const n = name.trim();
  if (m.source === "full_name") return n || "Member";
  if (m.source === "first_name") return n.split(/\s+/)[0] || "Member";
  return m.value || "";
}

async function callBroadcast(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("whatsapp-broadcast", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.success === false) throw new Error(data.error || "Request failed");
  return data;
}

export default function WhatsAppBroadcast() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading: tLoading, refetch: refetchT, isFetching: tFetching } = useAllWhatsAppTemplates();
  const [tKey, setTKey] = useState("");
  const tpl = templates.find((t) => `${t.name}|${t.language}` === tKey) || null;
  const [mapping, setMapping] = useState<Mapping[]>([]);
  useEffect(() => {
    if (tpl) setMapping(Array.from({ length: tpl.variable_count }, (_, i) => (i === 0 ? { source: "first_name" } : { source: "fixed", value: "" })));
  }, [tKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recipients
  const [audience, setAudience] = useState<Audience>("active");
  const [mode, setMode] = useState("all");
  const [tag, setTag] = useState("all");
  const [search, setSearch] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const { data: members = [], isLoading: mLoading } = useQuery({
    queryKey: ["broadcast-members"],
    queryFn: async () => {
      const all: MemberRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("wellness_members")
          .select("id, full_name, mobile_number, status, member_mode, tags, is_guest")
          .order("full_name").range(from, from + 999);
        if (error) throw error;
        all.push(...((data || []) as MemberRow[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });
  const allTags = useMemo(() => [...new Set(members.flatMap((m) => m.tags || []))].sort(), [members]);

  const filtered = useMemo(() => members.filter((m) => {
    if (audience === "active" && !ACTIVE.includes(m.status)) return false;
    if (audience === "expired" && !["expired", "inactive"].includes(m.status)) return false;
    if (audience === "trial" && !(m.is_guest || m.status === "trial")) return false;
    if (mode !== "all" && m.member_mode !== mode) return false;
    if (tag !== "all" && !(m.tags || []).includes(tag)) return false;
    return true;
  }), [members, audience, mode, tag]);
  const visible = filtered.filter((m) => !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.mobile_number.includes(search));
  const selected = filtered.filter((m) => !excluded.has(m.id));
  const validCount = new Set(selected.map((m) => m.mobile_number.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10)).size;

  const sample = selected[0]?.full_name || "राहुल";
  const vars = mapping.map((m) => varValue(m, sample));
  const preview = tpl ? fillTemplate(tpl.body, vars) : "";
  const approved = tpl?.status === "APPROVED";
  const mappingOk = mapping.every((m) => m.source !== "fixed" || (m.value || "").trim());

  const [testPhone, setTestPhone] = useState("");
  const test = useMutation({
    mutationFn: () => callBroadcast({ action: "test", phone: testPhone, template_name: tpl!.name, template_language: tpl!.language, variable_mapping: mapping, sample_name: sample }),
    onSuccess: () => toast.success("Test message sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const [confirm, setConfirm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => callBroadcast({
      action: "create", template_name: tpl!.name, template_language: tpl!.language,
      variable_mapping: mapping, member_ids: selected.map((m) => m.id),
      filters: { audience, mode, tag, excluded: excluded.size },
    }),
    onSuccess: (d) => { setActiveId(d.id); toast.success("Broadcast started"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_broadcasts").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data as { status: string }[] | undefined)?.some((b) => b.status === "sending") ? 3000 : false),
  });
  const active = history.find((b) => b.id === activeId) || history.find((b) => b.status === "sending");

  const retry = useMutation({
    mutationFn: (id: string) => callBroadcast({ action: "retry_failed", id }),
    onSuccess: () => { toast.success("Retrying failed messages"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resume = useMutation({
    mutationFn: (id: string) => callBroadcast({ action: "process", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });

  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const { data: failedRows = [] } = useQuery({
    queryKey: ["broadcast-failed", openFailed],
    enabled: !!openFailed,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_broadcast_recipients").select("full_name, phone, status, error")
        .eq("broadcast_id", openFailed!).in("status", ["failed", "skipped"]).limit(500);
      return data || [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Megaphone className="h-6 w-6" /> WhatsApp broadcast</h1>
        <p className="text-sm text-muted-foreground">Send an approved template to many members at once.</p>
      </div>

      {active && active.status === "sending" && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Sending {active.template_name}…</span>
              <span>{active.sent_count + active.failed_count + active.skipped_count} / {active.total_count}</span>
            </div>
            <Progress value={((active.sent_count + active.failed_count + active.skipped_count) / Math.max(1, active.total_count)) * 100} />
            <p className="text-xs text-muted-foreground">Sent {active.sent_count} · Failed {active.failed_count} · Skipped {active.skipped_count}. You can leave this page — sending continues.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle className="text-lg">1. Template</CardTitle><CardDescription>Only approved templates can be sent.</CardDescription></div>
            <Button variant="ghost" size="icon" onClick={() => refetchT()} aria-label="Refresh templates">
              <RefreshCw className={tFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={tKey} onValueChange={setTKey}>
              <SelectTrigger><SelectValue placeholder={tLoading ? "Loading…" : "Choose a template"} /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                    {t.name} ({t.language}) — {t.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tpl && !approved && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Waiting for Meta approval (status: {tpl.status}{tpl.rejected_reason ? ` — ${tpl.rejected_reason}` : ""}). Tap refresh to check again.
              </p>
            )}
            {mapping.map((m, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr] items-center gap-2">
                <Label className="text-xs">{`{{${i + 1}}}`}</Label>
                <div className="flex gap-2">
                  <Select value={m.source} onValueChange={(v) => setMapping((o) => o.map((x, j) => (j === i ? { ...x, source: v as Mapping["source"] } : x)))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_name">First name</SelectItem>
                      <SelectItem value="full_name">Full name</SelectItem>
                      <SelectItem value="fixed">Fixed text</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.source === "fixed" && (
                    <Input value={m.value || ""} onChange={(e) => setMapping((o) => o.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  )}
                </div>
              </div>
            ))}
            {tpl && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preview for {sample}</Label>
                <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                  {tpl.header && <p className="mb-2 font-semibold">{tpl.header}</p>}
                  {preview}
                </div>
              </div>
            )}
            {tpl && (
              <div className="flex gap-2">
                <Input placeholder="Your mobile for a test" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                <Button variant="outline" disabled={!approved || !mappingOk || test.isPending || !testPhone} onClick={() => test.mutate()}>
                  {test.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send test
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">2. Recipients</CardTitle><CardDescription>{selected.length} selected · {validCount} valid numbers</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Select value={audience} onValueChange={(v) => { setAudience(v as Audience); setExcluded(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active members</SelectItem>
                  <SelectItem value="expired">Expired / inactive</SelectItem>
                  <SelectItem value="trial">Trial guests</SelectItem>
                  <SelectItem value="all">Everyone</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Physical + Virtual</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any tag</SelectItem>
                  {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => setExcluded(new Set())}>All</Button>
              <Button variant="outline" size="sm" onClick={() => setExcluded(new Set(filtered.map((m) => m.id)))}>None</Button>
            </div>
            <ScrollArea className="h-80 rounded-md border">
              {mLoading && <p className="p-3 text-sm text-muted-foreground">Loading members…</p>}
              {visible.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm">
                  <Checkbox checked={!excluded.has(m.id)} onCheckedChange={(c) => setExcluded((o) => { const n = new Set(o); c ? n.delete(m.id) : n.add(m.id); return n; })} />
                  <span className="flex-1 truncate">{m.full_name}</span>
                  <span className="text-xs text-muted-foreground">{m.mobile_number}</span>
                </label>
              ))}
            </ScrollArea>
            <Button className="w-full" size="lg" disabled={!approved || !mappingOk || !validCount || create.isPending || active?.status === "sending"} onClick={() => setConfirm(true)}>
              <Send className="mr-2 h-4 w-4" /> Send to {validCount} members
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!history.length && <p className="text-sm text-muted-foreground">No broadcasts yet.</p>}
          {history.map((b) => (
            <div key={b.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.template_name}</span>
                <Badge variant={b.status === "completed" ? "secondary" : "default"}>{b.status}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                <span className="ml-auto text-xs">Total {b.total_count} · Sent {b.sent_count} · Failed {b.failed_count} · Skipped {b.skipped_count}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {(b.failed_count > 0 || b.skipped_count > 0) && (
                  <Button size="sm" variant="ghost" onClick={() => setOpenFailed(openFailed === b.id ? null : b.id)}>
                    {openFailed === b.id ? "Hide" : "Show"} failed / skipped
                  </Button>
                )}
                {b.failed_count > 0 && <Button size="sm" variant="outline" onClick={() => retry.mutate(b.id)}>Retry failed</Button>}
                {b.status === "sending" && <Button size="sm" variant="outline" onClick={() => resume.mutate(b.id)}>Resume</Button>}
              </div>
              {openFailed === b.id && (
                <div className="mt-2 max-h-60 overflow-auto rounded border">
                  {failedRows.map((r, i) => (
                    <div key={i} className="flex gap-2 border-b px-2 py-1 text-xs">
                      <span className="w-40 truncate">{r.full_name}</span>
                      <span className="w-28">{r.phone}</span>
                      <span className="flex-1 text-destructive">{r.status}: {r.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {validCount} members?</AlertDialogTitle>
            <AlertDialogDescription>
              "{tpl?.name}" will go out from the centre's WhatsApp number. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => create.mutate()}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
