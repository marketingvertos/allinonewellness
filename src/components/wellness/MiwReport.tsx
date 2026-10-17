import { useEffect, useState } from "react";
import { useCreateMiwChallenge, useMiwChallenges, useMiwReport, useUpdateMiwChallenge, useWellnessMembers } from "@/hooks/useWellness";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { MiwRegistrationDialog } from "./MiwRegistrationDialog";
import { downloadXlsx } from "@/lib/reportExport";
import { downloadBrandedPdf } from "@/lib/reportPdf";
import { formatCurrency, formatDate, todayIst } from "@/lib/formatters";
import { miwChange, miwEndDate, MIW_DEFAULT_FEE } from "@/lib/miw";
import { Download, Plus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MiwReport({ month }: { month: string }) {
  const { data: challenges, error: listError } = useMiwChallenges();
  const { user } = useAuth();
  const { data: manager } = useQuery({ queryKey: ["miw-manager", user?.id], enabled: !!user, queryFn: async () => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("is_wellness_manager", { _user_id: user.id });
    if (error) throw error;
    return data;
  } });
  const [id, setId] = useState("");
  const filtered = (challenges ?? []).filter(c => c.start_date.slice(0, 7) === month);
  useEffect(() => { if (!filtered.some(c => c.id === id)) setId(filtered[0]?.id ?? ""); }, [challenges, month, id]);
  const challenge = filtered.find(c => c.id === id);
  const { data: report, error, isLoading } = useMiwReport(id || null);
  const { data: members } = useWellnessMembers("", "all");
  const create = useCreateMiwChallenge();
  const update = useUpdateMiwChallenge();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayIst());
  const [end, setEnd] = useState(miwEndDate(todayIst()));
  const [fee, setFee] = useState(String(MIW_DEFAULT_FEE));
  const [status, setStatus] = useState("open");
  const [memberId, setMemberId] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [journeyId, setJourneyId] = useState("");
  const journey = report?.participants.find(p => p.member_id === journeyId);
  const rows = report?.participants ?? [];
  const changes = rows.map(p => miwChange(p.start_weight, p.latest_weight));
  const losses = changes.filter((n): n is number => n != null && n < 0);
  const lost = -losses.reduce((sum, n) => sum + n, 0);
  const measured = changes.filter((n): n is number => n != null);
  const average = measured.length ? -measured.reduce((s, n) => s + n, 0) / measured.length : null;
  const headers = ["Rank", "Member", "Start kg", "Latest kg", "Change kg", "Visits", "Days / 21"];
  const body = rows.map((p, i) => [changes[i] == null ? "—" : i + 1, p.member_name, p.start_weight ?? "—", p.latest_weight ?? "—", changes[i] ?? "—", p.visits, p.days_attended]);
  const filename = `${challenge?.name ?? "MIW"}-${challenge?.start_date ?? month}`.replace(/[^a-zA-Z0-9 -]/g, "-");
  const showForm = (edit: boolean) => {
    setEditing(edit); setName(edit ? challenge?.name ?? "" : "");
    setStart(edit ? challenge?.start_date ?? todayIst() : todayIst());
    setEnd(edit ? challenge?.end_date ?? miwEndDate(todayIst()) : miwEndDate(todayIst()));
    setFee(String(edit ? challenge?.fee ?? MIW_DEFAULT_FEE : MIW_DEFAULT_FEE));
    setStatus(edit ? challenge?.status ?? "open" : "open"); setOpen(true);
  };
  const save = async () => {
    try {
      if (editing && challenge) await update.mutateAsync({ id: challenge.id, name, startDate: start, endDate: end, fee: Number(fee), status });
      else { const c = await create.mutateAsync({ name, startDate: start, endDate: end, fee: Number(fee) }); setId(c.id); }
      setOpen(false);
    } catch { /* mutation displays error */ }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Select value={id} onValueChange={setId}><SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select MIW challenge" /></SelectTrigger><SelectContent>{filtered.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><div className="flex gap-2">{manager && <><Button variant="outline" disabled={!challenge} onClick={() => showForm(true)}>Edit challenge</Button><Button onClick={() => showForm(false)}><Plus className="mr-2 h-4 w-4" />New challenge</Button></>}</div></div>
    {(error || listError) && <p role="alert" className="text-destructive">{(error || listError)?.message}</p>}
    {isLoading && <p>Loading challenge report…</p>}
    {!challenge && <p className="text-muted-foreground">No MIW challenge for this month.</p>}
    {challenge && <><div className="flex flex-wrap justify-between gap-3 border-b pb-4"><div><h2 className="text-xl font-semibold">{challenge.name}</h2><p className="text-sm text-muted-foreground">{formatDate(challenge.start_date)} — {formatDate(challenge.end_date)} · {challenge.status} · Fee {formatCurrency(Number(challenge.fee))}</p></div><div className="flex gap-2"><Button variant="outline" disabled={!report} onClick={() => downloadXlsx(`${filename}.xlsx`, "MIW report", [[challenge.name], [`${challenge.start_date} — ${challenge.end_date}`], ["Participants", rows.length, "Collected INR", Number(report?.total_paid ?? 0)], headers, ...body])}><Download className="mr-2 h-4 w-4" />Excel</Button><Button variant="outline" disabled={!report} onClick={() => void downloadBrandedPdf({ filename: `${filename}.pdf`, title: challenge.name, period: `${formatDate(challenge.start_date)} — ${formatDate(challenge.end_date)}`, orientation: "landscape", sections: [{ head: ["Participants", "Collected INR", "Total weight lost kg", "Average loss kg"], body: [[rows.length, Number(report?.total_paid ?? 0), lost.toFixed(2), average?.toFixed(2) ?? "—"]] }, { head: headers, body }] })}>PDF</Button></div></div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[["Participants", rows.length], ["Collected", formatCurrency(Number(report?.total_paid ?? 0))], ["Total weight lost", `${lost.toFixed(2)} kg`], ["Average weight lost", average == null ? "—" : `${average.toFixed(2)} kg`], ["Members who lost weight", losses.length]].map(([label, value]) => <div key={label} className="border-l-2 border-primary pl-3"><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}</div>
    <div className="flex flex-wrap gap-2"><Select value={memberId} onValueChange={setMemberId}><SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select member to register" /></SelectTrigger><SelectContent>{(members ?? []).filter(m => !rows.some(p => p.member_id === m.id)).map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent></Select><Button disabled={!memberId || challenge.status !== "open"} onClick={() => setRegisterOpen(true)}>Register member</Button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{headers.map(h => <th className="whitespace-nowrap p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((p, i) => <tr key={p.participant_id} className="border-b"><td className="p-3">{changes[i] == null ? "—" : i + 1}</td><td className="p-3"><Button variant="link" className="h-auto p-0" onClick={() => setJourneyId(p.member_id)}>{p.member_name}</Button></td><td className="p-3">{p.start_weight ?? "—"}</td><td className="p-3">{p.latest_weight ?? "—"}</td><td className="p-3">{changes[i] ?? "—"}</td><td className="p-3">{p.visits}</td><td className="p-3">{p.days_attended}/21</td></tr>)}</tbody></table>{!rows.length && <p className="py-6 text-muted-foreground">No registrations yet.</p>}</div></>}
    <ResponsiveDialog open={open} onOpenChange={setOpen} title={editing ? "Edit MIW challenge" : "New MIW challenge"} footer={<Button disabled={!name.trim() || !start || !end || end < start || Number(fee) <= 0 || create.isPending || update.isPending} onClick={save}>Save challenge</Button>}><div className="space-y-4"><Label htmlFor="miw-name">Challenge name</Label><Input id="miw-name" value={name} onChange={e => setName(e.target.value)} /><Label htmlFor="miw-start">Start date</Label><Input id="miw-start" type="date" value={start} onChange={e => { setStart(e.target.value); if (e.target.value) setEnd(miwEndDate(e.target.value)); }} /><Label htmlFor="miw-end">End date</Label><Input id="miw-end" type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /><Label htmlFor="miw-fee">Registration fee (₹)</Label><Input id="miw-fee" type="number" min="1" value={fee} onChange={e => setFee(e.target.value)} />{editing && <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["open", "closed", "completed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}</div></ResponsiveDialog>
    <MiwRegistrationDialog memberId={memberId} open={registerOpen} onOpenChange={setRegisterOpen} />
    <ResponsiveDialog open={!!journey} onOpenChange={v => { if (!v) setJourneyId(""); }} title={`${journey?.member_name ?? "Member"} — weight journey`}><div className="h-72">{journey?.journey?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={journey.journey}><XAxis dataKey="recorded_date" tickFormatter={formatDate} /><YAxis domain={["auto", "auto"]} /><Tooltip /><Line dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart></ResponsiveContainer> : <p className="text-muted-foreground">No weight readings in this challenge yet.</p>}</div></ResponsiveDialog>
  </div>;
}