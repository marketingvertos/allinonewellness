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
import { Loader2, Megaphone, Plus, RefreshCw, Send, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";
import { useAllWhatsAppTemplates } from "@/hooks/useWhatsApp";
import { fillTemplate } from "@/components/whatsapp/TemplatePicker";
import { Link } from "react-router-dom";
import { callBroadcast } from "@/lib/broadcastApi";
import { funnel } from "@/lib/broadcastStatus";
const friendlyError = (e?: string | null) => !e ? "" : /ecosystem|131049/i.test(e) ? "Meta marketing limit for this person, Retry works after 24 hours" : /132012|IMAGE/i.test(e) ? "Picture missing (fixed, can retry)" : e;
import familyPoster from "@/assets/family-day-4-oct-2026.jpg.asset.json";

type Mapping = { source: "first_name" | "full_name" | "fixed"; value?: string };
type Audience = "active" | "expired" | "trial" | "all" | "list";

/** Finds a name and 10-digit mobile in each row of pasted text or a sheet. */
function parseContacts(rows: unknown[][]) {
  const out = new Map<string, { full_name: string; phone: string }>();
  for (const row of rows) {
    const cells = row.map((c) => String(c ?? "").trim());
    const phoneCell = cells.find((c) => { const d = c.replace(/\D/g, ""); return d.length >= 10 && d.length <= 13; });
    if (!phoneCell) continue;
    const phone = phoneCell.replace(/\D/g, "").slice(-10);
    const full_name = cells.find((c) => c !== phoneCell && /[a-z\u0900-\u097F]/i.test(c) && !c.includes("@")) || "";
    if (!out.has(phone)) out.set(phone, { full_name, phone });
  }
  return [...out.values()];
}
const textRows = (t: string) => t.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[,\t;]/));

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

export default function WhatsAppBroadcast() {
  const qc = useQueryClient();
  const { data: rawTemplates = [], isLoading: tLoading, refetch: refetchT, isFetching: tFetching } = useAllWhatsAppTemplates();
  const [tSearch, setTSearch] = useState("");
  const allSorted = [...rawTemplates].sort((a, b) =>
    Number(b.status === "APPROVED") - Number(a.status === "APPROVED") ||
    String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true }));
  const templates = allSorted.filter((t) => !tSearch || t.name.toLowerCase().includes(tSearch.toLowerCase()));
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
  const [listId, setListId] = useState("");
  const { data: lists = [] } = useQuery({
    queryKey: ["broadcast-lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_broadcast_lists").select("id, name, whatsapp_broadcast_list_members(count)").order("created_at", { ascending: false });
      if (error) throw error;
      // deno-lint-ignore no-explicit-any
      return (data || []).map((l: any) => ({ id: l.id as string, name: l.name as string, count: l.whatsapp_broadcast_list_members?.[0]?.count ?? 0 }));
    },
  });
  const { data: listPeople = [], isLoading: lLoading } = useQuery({
    queryKey: ["broadcast-list-people", listId],
    enabled: audience === "list" && !!listId,
    queryFn: async () => {
      const all: MemberRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("whatsapp_broadcast_list_members").select("id, full_name, phone").eq("list_id", listId).order("full_name").range(from, from + 999);
        if (error) throw error;
        all.push(...(data || []).map((c) => ({ id: c.id, full_name: c.full_name || "", mobile_number: c.phone, status: "", member_mode: "", tags: [], is_guest: false })));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });
  const allTags = useMemo(() => [...new Set(members.flatMap((m) => m.tags || []))].sort(), [members]);

  const filtered = useMemo(() => audience === "list" ? (listId ? listPeople : []) : members.filter((m) => {
    if (audience === "active" && !ACTIVE.includes(m.status)) return false;
    if (audience === "expired" && !["expired", "inactive"].includes(m.status)) return false;
    if (audience === "trial" && !(m.is_guest || m.status === "trial")) return false;
    if (mode !== "all" && m.member_mode !== mode) return false;
    if (tag !== "all" && !(m.tags || []).includes(tag)) return false;
    return true;
  }), [members, audience, mode, tag, listId, listPeople]);
  const visible = filtered.filter((m) => !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.mobile_number.includes(search));
  const selected = filtered.filter((m) => !excluded.has(m.id));
  const validCount = new Set(selected.map((m) => m.mobile_number.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10)).size;

  const sample = selected[0]?.full_name || "राहुल";
  const vars = mapping.map((m) => varValue(m, sample));
  const preview = tpl ? fillTemplate(tpl.body, vars) : "";
  const approved = tpl?.status === "APPROVED";
  const isFamilyPoster = tpl?.name === "family_day_4_oct";
  const imageReady = !isFamilyPoster || (tpl?.language === "hi" && tpl?.header_format === "IMAGE");
  const mappingOk = mapping.every((m) => m.source !== "fixed" || (m.value || "").trim());

  const [testPhone, setTestPhone] = useState("");
  const test = useMutation({
    mutationFn: () => callBroadcast({ action: "test", phone: testPhone, template_name: tpl!.name, template_language: tpl!.language, variable_mapping: mapping, sample_name: sample }),
    onSuccess: () => toast.success("Test message sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const [confirm, setConfirm] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [hSearch, setHSearch] = useState("");
  const [hDays, setHDays] = useState("30");
  const [activeId, setActiveId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => callBroadcast({
      action: "create", template_name: tpl!.name, template_language: tpl!.language,
      variable_mapping: mapping,
      ...(audience === "list" ? { list_id: listId, excluded_ids: [...excluded] } : { member_ids: selected.map((m) => m.id) }),
      filters: { audience, mode, tag, list_id: audience === "list" ? listId : null, excluded: excluded.size },
      scheduled_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
    }),
    onSuccess: (d) => { setActiveId(d.id); toast.success(d.scheduled ? "Broadcast scheduled" : "Broadcast started"); setScheduleAt(""); qc.invalidateQueries({ queryKey: ["broadcasts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_broadcasts").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data as { status: string }[] | undefined)?.some((b) => b.status === "sending") ? 3000 : false),
  });
  const shown = history.filter((b) => (!hSearch || b.template_name.toLowerCase().includes(hSearch.toLowerCase())) &&
    (hDays === "all" || new Date(b.created_at).getTime() > Date.now() - Number(hDays) * 864e5));
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

  const [listDialog, setListDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [paste, setPaste] = useState("");
  const [fileRows, setFileRows] = useState<{ full_name: string; phone: string }[] | null>(null);
  const parsed = fileRows ?? parseContacts(textRows(paste));
  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const rows: unknown[][] = wb.SheetNames.flatMap((n) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: false }));
    const found = parseContacts(rows);
    setFileRows(found);
    setPaste(found.map((c) => `${c.full_name}, ${c.phone}`).join("\n"));
  };
  const saveList = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Give the list a name");
      if (!parsed.length) throw new Error("No valid 10-digit mobile numbers found");
      const { data: u } = await supabase.auth.getUser();
      const { data: l, error } = await supabase.from("whatsapp_broadcast_lists").insert({ name: newName.trim(), created_by: u.user?.id }).select("id").single();
      if (error) throw error;
      for (let i = 0; i < parsed.length; i += 500) {
        const { error: e2 } = await supabase.from("whatsapp_broadcast_list_members").insert(parsed.slice(i, i + 500).map((c) => ({ ...c, list_id: l.id })));
        if (e2) throw e2;
      }
      return { id: l.id, count: parsed.length };
    },
    onSuccess: (r) => {
      toast.success(`List saved with ${r.count} contacts`);
      setListDialog(false); setNewName(""); setPaste(""); setFileRows(null);
      qc.invalidateQueries({ queryKey: ["broadcast-lists"] });
      setAudience("list"); setListId(r.id); setExcluded(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteList = async (id: string) => {
    if (!window.confirm("Delete this list? Past broadcasts are kept.")) return;
    const { error } = await supabase.from("whatsapp_broadcast_lists").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setListId(""); qc.invalidateQueries({ queryKey: ["broadcast-lists"] });
  };

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
            <Input placeholder="Search templates…" value={tSearch} onChange={(e) => setTSearch(e.target.value)} />
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
            {isFamilyPoster && !imageReady && (
              <p className="border border-destructive p-3 text-sm text-destructive">This template needs an approved image header in Hindi before the picture can be sent.</p>
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
                  {isFamilyPoster && imageReady && <img src={familyPoster.url} alt="Family Day invitation poster" className="mx-auto mb-3 max-h-52 w-auto object-contain" />}
                  {tpl.header && <p className="mb-2 font-semibold">{tpl.header}</p>}
                  {preview}
                </div>
              </div>
            )}
            {tpl && (
              <div className="flex gap-2">
                <Input placeholder="Your mobile for a test" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                <Button variant="outline" disabled={!approved || !imageReady || !mappingOk || test.isPending || !testPhone} onClick={() => test.mutate()}>
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
                  <SelectItem value="list">Saved list</SelectItem>
                </SelectContent>
              </Select>
              {audience === "list" ? (
                <div className="col-span-2 flex gap-2">
                  <Select value={listId} onValueChange={(v) => { setListId(v); setExcluded(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Pick a list" /></SelectTrigger>
                    <SelectContent>
                      {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.count})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" aria-label="New list" onClick={() => setListDialog(true)}><Plus className="h-4 w-4" /></Button>
                  {listId && <Button variant="outline" size="icon" aria-label="Delete list" onClick={() => deleteList(listId)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ) : (<>
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
              </>)}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => setExcluded(new Set())}>All</Button>
              <Button variant="outline" size="sm" onClick={() => setExcluded(new Set(filtered.map((m) => m.id)))}>None</Button>
            </div>
            <ScrollArea className="h-80 rounded-md border">
              {(mLoading || (audience === "list" && lLoading)) && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
              {audience === "list" && !listId && <p className="p-3 text-sm text-muted-foreground">Pick a saved list or tap + to create one.</p>}
              {visible.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm">
                  <Checkbox checked={!excluded.has(m.id)} onCheckedChange={(c) => setExcluded((o) => { const n = new Set(o); c ? n.delete(m.id) : n.add(m.id); return n; })} />
                  <span className="flex-1 truncate">{m.full_name}</span>
                  <span className="text-xs text-muted-foreground">{m.mobile_number}</span>
                </label>
              ))}
            </ScrollArea>
            <Button className="w-full" size="lg" disabled={!approved || !imageReady || !mappingOk || !validCount || create.isPending || active?.status === "sending"} onClick={() => setConfirm(true)}>
              <Send className="mr-2 h-4 w-4" /> Send to {validCount} members
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Broadcast reports</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Search template" value={hSearch} onChange={(e) => setHSearch(e.target.value)} />
            <Select value={hDays} onValueChange={setHDays}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            const t = shown.reduce((a, b) => ({ total_count: a.total_count + b.total_count, sent_count: a.sent_count + b.sent_count, failed_count: a.failed_count + b.failed_count, skipped_count: a.skipped_count + b.skipped_count, delivered_count: a.delivered_count + (b.delivered_count || 0), read_count: a.read_count + (b.read_count || 0), replied_count: a.replied_count + (b.replied_count || 0) }), { total_count: 0, sent_count: 0, failed_count: 0, skipped_count: 0, delivered_count: 0, read_count: 0, replied_count: 0 });
            const f = funnel(t);
            return (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[["Broadcasts", shown.length], ["Messages sent", f.sent], ["Delivered", `${f.deliveryRate}%`], ["Read", `${f.readRate}%`], ["Replies", f.replied]].map(([l, v]) => (
                  <div key={l as string} className="rounded-md border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold tabular-nums">{v}</div></div>
                ))}
              </div>
            );
          })()}
        </CardHeader>
        <CardContent className="space-y-2">
          {!shown.length && <p className="text-sm text-muted-foreground">No broadcasts in this period.</p>}
          {shown.map((b) => {
            const f = funnel(b);
            const w = (n: number) => `${f.total ? (n / f.total) * 100 : 0}%`;
            return (
              <Link key={b.id} to={`/whatsapp/broadcast/${b.id}`} className="block rounded-md border p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{b.template_name}</span>
                  <Badge variant={b.status === "completed" ? "secondary" : "default"} className={b.status === "sending" ? "animate-pulse" : ""}>{b.status}</Badge>
                  {b.parent_broadcast_id && <Badge variant="outline">follow-up</Badge>}
                  <span className="text-xs text-muted-foreground">{new Date(b.scheduled_at || b.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="ml-auto text-xs tabular-nums">{f.total} people · {f.sent} sent · {f.delivered} delivered ({f.deliveryRate}%) · {f.read} read ({f.readRate}%) · {f.replied} replied · {f.failed} failed</span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded bg-muted">
                  <div className="bg-primary" style={{ width: w(f.read) }} />
                  <div className="bg-primary/60" style={{ width: w(f.delivered - f.read) }} />
                  <div className="bg-primary/25" style={{ width: w(f.sent - f.delivered) }} />
                  <div className="bg-destructive" style={{ width: w(f.failed) }} />
                </div>
              </Link>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">Bar: dark = read, mid = delivered, light = sent only, red = failed. Open a broadcast for the full recipient report.</p>
        </CardContent>
      </Card>

      <Dialog open={listDialog} onOpenChange={setListDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New saved list</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>List name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Family Day guests Oct 2026" /></div>
            <div className="space-y-1">
              <Label>Contacts — one per line: name, mobile</Label>
              <Textarea rows={8} value={paste} onChange={(e) => { setPaste(e.target.value); setFileRows(null); }} placeholder={"Rahul Sharma, 9876543210\nPriya Jain, 9123456780"} />
              <div className="flex items-center justify-between">
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                  <Upload className="h-3.5 w-3.5" /> Upload CSV or Excel
                  <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f).catch(() => toast.error("Could not read this file")); e.target.value = ""; }} />
                </label>
                <span className="text-xs text-muted-foreground">{parsed.length} valid numbers found</span>
              </div>
            </div>
            <Button className="w-full" disabled={saveList.isPending} onClick={() => saveList.mutate()}>
              {saveList.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save list
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {validCount} members?</AlertDialogTitle>
            <AlertDialogDescription>
              "{tpl?.name}" {isFamilyPoster ? "with the Family Day picture " : ""}will go out from the centre's WhatsApp number. This cannot be undone.
              {tpl?.category ? ` Category: ${tpl.category} (Meta charges ${tpl.category === "MARKETING" ? "marketing" : tpl.category === "UTILITY" ? "utility" : "per"} rates).` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Send later (optional, India time)</Label>
            <Input type="datetime-local" value={scheduleAt} min={new Date(Date.now() + 5 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setScheduleAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">Scheduled broadcasts start within about 10 minutes of the chosen time.</p>
          </div>
          <AlertDialogHeader className="hidden">
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => create.mutate()}>{scheduleAt ? "Schedule" : "Send now"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
