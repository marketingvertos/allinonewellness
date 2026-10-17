import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MiwReport } from "@/components/wellness/MiwReport";
import { PageBanner } from "@/components/PageBanner";
import { ScheduleEventDialog } from "@/components/wellness/ScheduleEventDialog";
import {
  EventType,
  currentMonthIst,
  monthLabel,
  recentMonths,
  useCalcMonthlyRewards,
  useDeleteEvent,
  useMonthlyRewards,
  useWellnessEvents,
} from "@/hooks/useEvents";
import { PAYMENT_MODES, paymentModeLabel, useMilestoneHolders, useMonthlyWeightRewards, useRevenueReport, useWeightDataMonths } from "@/hooks/useReports";
import {
  MiwChallenge,
  MiwReportData,
  MiwReportParticipant,
  useCreateMiwChallenge,
  useMiwChallenges,
  useMiwRegisterMember,
  useMiwReport,
  useRemoveMiwParticipant,
  useUpdateMiwChallenge,
  useWellnessMembers,
  useWlpMonthlyCheckins,
  WellnessMember,
} from "@/hooks/useWellness";
import { EditMemberDialog } from "@/components/wellness/EditMemberDialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, todayIst } from "@/lib/formatters";
import { CalendarDays, Download, Edit2, Plus, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: challenges } = useMiwChallenges();
  const months = [...new Set([...recentMonths(12), ...(challenges ?? []).map(c => c.start_date.slice(0, 7))])].sort().reverse();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function downloadCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${todayIst()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Event tab ----------------------------- */

function EventTab({ eventType, month }: { eventType: EventType; month: string }) {
  const { data: events } = useWellnessEvents(month, eventType);
  const deleteEvent = useDeleteEvent();
  const [open, setOpen] = useState(false);
  const event = events?.[0] ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">
            {eventType === "family_day" ? "Family Day" : "Lifestyle Day"} — {monthLabel(month)}
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            {event ? "Edit" : <><Plus className="mr-2 h-4 w-4" /> Schedule</>}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {event ? (
            <>
              <p className="text-lg font-semibold">{formatDate(event.event_date)}</p>
              <p className="text-muted-foreground">{event.title}</p>
              {event.description && <p className="text-muted-foreground">{event.description}</p>}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteEvent.mutate(event.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Nothing scheduled for this month yet.</p>
          )}
        </CardContent>
      </Card>

      {eventType === "family_day" && <WeightRewardsCard month={month} />}
      {eventType === "family_day" && <RewardsCard month={month} />}

      <ScheduleEventDialog
        eventType={eventType}
        month={month}
        existing={event}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function RewardsCard({ month }: { month: string }) {
  const { data: rewards } = useMonthlyRewards(month);
  const calc = useCalcMonthlyRewards();
  const { data: milestones } = useMilestoneHolders();
  const consistency = (rewards ?? []).filter((r) => r.reward_type === "consistency_26");

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">Consistency rewards (26+ days)</CardTitle>
          <Button size="sm" variant="outline" onClick={() => calc.mutate(month)} disabled={calc.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" /> Recalculate
          </Button>
        </CardHeader>
        <CardContent>
          {consistency.length ? (
            <div className="space-y-2">
              {consistency.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{r.wellness_members?.full_name}</span>
                  <Badge variant="secondary">
                    {String((r.details as { attendance_days?: number }).attendance_days ?? 0)} days
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No one has reached 26 days this month yet — press Recalculate to refresh.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Milestone holders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {milestones?.length ? (
            milestones.map((m) => (
              <div key={m.milestone}>
                <p className="mb-2 text-sm font-medium">
                  {m.icon} {m.milestone} <span className="text-muted-foreground">({m.members.length})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {m.members.map((mem) => (
                    <Badge key={mem.id + m.milestone} variant="outline">{mem.name}</Badge>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No milestones reached yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Family Day: members who lost 5+ kg or gained 3+ kg in a chosen month. */
function WeightRewardsCard({ month }: { month: string }) {
  const [selected, setSelected] = useState(month);
  const { data: months } = useWeightDataMonths();
  const { data, isPending } = useMonthlyWeightRewards(selected);

  const options = useMemo(() => {
    const list = months ?? [selected];
    // Show newest first so the current month is at the top.
    return [...list].sort().reverse();
  }, [months, selected]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">Weight rewards — 5 kg loss / 3 kg gain</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((mo) => (
                <SelectItem key={mo} value={mo}>{monthLabel(mo)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || (!data?.loss.length && !data?.gain.length)}
            onClick={() =>
              downloadCsv(
                `weight-rewards-${selected}`,
                ["Name", "Goal", "First weigh-in (kg)", "Last weigh-in (kg)", "Change"],
                [
                  ...(data?.loss ?? []).map((r) => [r.name, "Weight loss", r.firstWeight, r.lastWeight, `${Math.abs(r.change)} kg lost`]),
                  ...(data?.gain ?? []).map((r) => [r.name, "Weight gain", r.firstWeight, r.lastWeight, `${r.change} kg gained`]),
                ],
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-emerald-600">
                Weight loss — 5 kg or more ({data?.loss.length ?? 0})
              </p>
              {data?.loss.length ? (
                <div className="space-y-2">
                  {data.loss.map((r) => (
                    <div key={r.memberId} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span className="font-medium">{r.name}</span>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">{Math.abs(r.change)} kg lost</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No one qualified this month.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-sky-600">
                Weight gain — 3 kg or more ({data?.gain.length ?? 0})
              </p>
              {data?.gain.length ? (
                <div className="space-y-2">
                  {data.gain.map((r) => (
                    <div key={r.memberId} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span className="font-medium">{r.name}</span>
                      <Badge className="bg-sky-600 hover:bg-sky-600">{r.change} kg gained</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No one qualified this month.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------- MIW tab ------------------------------ */

function MemberSearchInput({
  onSelect,
  placeholder = "Search by name or mobile…",
}: {
  onSelect: (member: WellnessMember) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { data: members } = useWellnessMembers(query, "all");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim() || !members) return [];
    const q = query.toLowerCase();
    return members.filter(
      (m) => m.full_name.toLowerCase().includes(q) || m.mobile_number.includes(q),
    ).slice(0, 15);
  }, [members, query]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {query && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted" onClick={() => { setQuery(""); setShowResults(false); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {showResults && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((m) => (
            <button
              key={m.id}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => { onSelect(m); setQuery(""); setShowResults(false); }}
            >
              <span className="font-medium">{m.full_name}</span>
              <span className="text-xs text-muted-foreground">{m.mobile_number}</span>
            </button>
          ))}
        </div>
      )}
      {showResults && query.trim().length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-lg">
          No members found
        </div>
      )}
    </div>
  );
}

function ChallengeDialog({
  existing,
  open,
  onOpenChange,
}: {
  existing?: MiwChallenge | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateMiwChallenge();
  const update = useUpdateMiwChallenge();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fee, setFee] = useState("500");

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setStartDate(existing?.start_date ?? todayIst());
      setEndDate(existing?.end_date ?? "");
      setFee(String(existing?.fee ?? 500));
    }
  }, [open, existing]);

  useEffect(() => {
    if (!existing && startDate && !endDate) {
      const d = new Date(startDate + "T00:00:00");
      d.setDate(d.getDate() + 20);
      setEndDate(d.toISOString().slice(0, 10));
    }
  }, [startDate, existing, endDate]);

  const save = async () => {
    const f = Number(fee) || 500;
    if (existing) {
      await update.mutateAsync({ id: existing.id, name, startDate, endDate, fee: f });
    } else {
      await create.mutateAsync({ name: name || "MIW Challenge", startDate, endDate, fee: f });
    }
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={existing ? "Edit Challenge" : "New MIW Challenge"}>
      <div className="space-y-4 py-2">
        <div>
          <Label>Challenge name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MIW Challenge" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(""); }} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Fee (₹)</Label>
          <Input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        <Button className="w-full" onClick={save} disabled={create.isPending || update.isPending || !startDate || !endDate}>
          {existing ? "Update" : "Create challenge"}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}

function RegisterMemberDialog({
  challengeId,
  member,
  open,
  onOpenChange,
  defaultFee,
}: {
  challengeId: string;
  member: WellnessMember | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFee: number;
}) {
  const register = useMiwRegisterMember();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(String(defaultFee));
      setMode("cash");
      setReference("");
    }
  }, [open, defaultFee]);

  const submit = async () => {
    if (!member) return;
    const amt = Number(amount) || 0;
    const payments = amt > 0 ? [{ amount: amt, mode, reference: reference || undefined }] : [];
    await register.mutateAsync({ challengeId, memberId: member.id, payments });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Register for MIW Challenge">
      <div className="space-y-4 py-2">
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="font-medium">{member?.full_name}</p>
          <p className="text-sm text-muted-foreground">{member?.mobile_number}</p>
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Payment mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(mode === "upi" || mode === "online" || mode === "card") && (
          <div>
            <Label>Reference / Txn ID</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
        )}
        <Button className="w-full" onClick={submit} disabled={register.isPending || !member}>
          <UserPlus className="mr-2 h-4 w-4" /> Register &amp; pay ₹{Number(amount) || 0}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}

function MiwTab() {
  const { data: challenges } = useMiwChallenges();
  const updateChallenge = useUpdateMiwChallenge();
  const removeParticipant = useRemoveMiwParticipant();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeChallenge = challenges?.find((c) => c.id === selectedId) ?? challenges?.[0] ?? null;
  const challengeId = activeChallenge?.id ?? null;

  useEffect(() => {
    if (!selectedId && challenges?.length) setSelectedId(challenges[0].id);
  }, [challenges, selectedId]);

  const { data: report } = useMiwReport(challengeId);

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<MiwChallenge | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerMember, setRegisterMember] = useState<WellnessMember | null>(null);
  const [editMember, setEditMember] = useState<WellnessMember | null>(null);
  const [editMemberOpen, setEditMemberOpen] = useState(false);

  const participants = report?.participants ?? [];
  const ranked = useMemo(() => {
    return [...participants].map((p, _i, _arr) => {
      const change = p.start_weight != null && p.latest_weight != null
        ? p.latest_weight - p.start_weight
        : null;
      return { ...p, change };
    }).sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity));
  }, [participants]);

  const onMemberSelected = useCallback((member: WellnessMember) => {
    setRegisterMember(member);
    setRegisterOpen(true);
  }, []);

  const openEditMember = useCallback((p: MiwReportParticipant) => {
    setEditMember({ id: p.member_id, full_name: p.member_name, mobile_number: p.mobile } as WellnessMember);
    setEditMemberOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Challenge selector & CRUD */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">MIW Challenge</CardTitle>
          <div className="flex gap-2">
            {activeChallenge && activeChallenge.status === "open" && (
              <Button size="sm" variant="outline" onClick={() => updateChallenge.mutate({ id: activeChallenge.id, status: "closed" })}>
                Close
              </Button>
            )}
            {activeChallenge && (
              <Button size="sm" variant="outline" onClick={() => { setEditingChallenge(activeChallenge); setChallengeDialogOpen(true); }}>
                <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
            )}
            <Button size="sm" onClick={() => { setEditingChallenge(null); setChallengeDialogOpen(true); }}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {challenges && challenges.length > 1 && (
            <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Select challenge" /></SelectTrigger>
              <SelectContent>
                {challenges.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({formatDate(c.start_date)} — {formatDate(c.end_date)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeChallenge ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{activeChallenge.name}</span>
              <span className="text-muted-foreground">{formatDate(activeChallenge.start_date)} — {formatDate(activeChallenge.end_date)}</span>
              <Badge variant={activeChallenge.status === "open" ? "default" : "secondary"}>
                {activeChallenge.status}
              </Badge>
              <span className="text-muted-foreground">Fee: ₹{activeChallenge.fee}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No challenges created yet. Click "New" to start one.</p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {report && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="text-2xl font-bold">{report.participant_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(report.total_paid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg weight change</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const withChange = ranked.filter((r) => r.change != null);
                  if (!withChange.length) return "—";
                  const avg = withChange.reduce((s, r) => s + r.change!, 0) / withChange.length;
                  return `${avg > 0 ? "+" : ""}${avg.toFixed(1)} kg`;
                })()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & register */}
      {activeChallenge && activeChallenge.status === "open" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add participant</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberSearchInput onSelect={onMemberSelected} placeholder="Search member by name or mobile…" />
          </CardContent>
        </Card>
      )}

      {/* Participants table */}
      {challengeId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">Participants ({ranked.length})</CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!ranked.length}
              onClick={() =>
                downloadCsv(
                  "miw-challenge",
                  ["Rank", "Name", "Mobile", "Gender", "Source", "Start weight", "Latest weight", "Change", "Visits", "Joined"],
                  ranked.map((r, i) => [
                    i + 1,
                    r.member_name,
                    r.mobile,
                    r.gender ?? "",
                    r.source,
                    r.start_weight ?? "",
                    r.latest_weight ?? "",
                    r.change != null ? r.change.toFixed(1) : "",
                    r.visits,
                    formatDate(r.joined_at),
                  ]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((r, i) => {
              const best = i === 0 && r.change != null && r.change < 0;
              return (
                <div
                  key={r.participant_id}
                  className={`flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm ${best ? "border-emerald-500 bg-emerald-500/5" : ""}`}
                >
                  <Badge variant={best ? "default" : "outline"}>#{i + 1}</Badge>
                  <div className="flex-1">
                    <span className="font-medium">{r.member_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.mobile}</span>
                  </div>
                  <span className="text-muted-foreground">Start {r.start_weight ?? "—"} kg</span>
                  <span className="text-muted-foreground">Now {r.latest_weight ?? "—"} kg</span>
                  <span className={r.change != null && r.change < 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                    {r.change != null ? `${r.change > 0 ? "+" : ""}${r.change.toFixed(1)} kg` : "—"}
                  </span>
                  <Badge variant="outline">{r.visits} visits</Badge>
                  <Button size="icon" variant="ghost" title="Edit member" onClick={() => openEditMember(r)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Remove from challenge"
                    onClick={() => {
                      if (confirm(`Remove ${r.member_name} from this challenge?`)) {
                        removeParticipant.mutate(r.participant_id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            {!ranked.length && (
              <p className="text-sm text-muted-foreground">No participants yet. Use the search above to add members.</p>
            )}
          </CardContent>
        </Card>
      )}

      <ChallengeDialog existing={editingChallenge} open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen} />
      {challengeId && registerMember && (
        <RegisterMemberDialog
          challengeId={challengeId}
          member={registerMember}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          defaultFee={activeChallenge?.fee ?? 500}
        />
      )}
      {editMember && (
        <EditMemberDialog member={editMember as WellnessMember} open={editMemberOpen} onOpenChange={setEditMemberOpen} />
      )}
    </div>
  );
}

/* ------------------------------- WLP tab ------------------------------ */

function WlpTab({ month }: { month: string }) {
  const { data: wlpCheckins } = useWlpMonthlyCheckins(month);
  const { data: rewards } = useMonthlyRewards(month);
  const calc = useCalcMonthlyRewards();

  const monthStart = `${month}-01`;
  const nextMonth = new Date(monthStart + "T00:00:00");
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthEnd = new Date(nextMonth.getTime() - 86400000);
  let totalWednesdays = 0;
  for (let d = new Date(monthStart + "T12:00:00"); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 3) totalWednesdays++;
  }

  const sorted = useMemo(
    () => [...(wlpCheckins ?? [])].sort((a, b) => b.wednesday_count - a.wednesday_count),
    [wlpCheckins],
  );

  const winners = (rewards ?? []).filter(
    (r) => r.reward_type === "wlp_king" || r.reward_type === "wlp_queen",
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">WLP attendance — {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {totalWednesdays} Wednesday{totalWednesdays === 1 ? "" : "s"} in {monthLabel(month)}.
            Members present on all {totalWednesdays} earn WLP King/Queen.
          </p>

          <div className="space-y-2">
            {sorted.length ? (
              sorted.map((m) => {
                const perfect = m.wednesday_count >= totalWednesdays;
                return (
                  <div
                    key={m.member_id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <span className="flex-1 font-medium">{m.member_name}</span>
                    <Badge variant={perfect ? "default" : "outline"}>
                      {m.wednesday_count}/{totalWednesdays} Wednesdays
                    </Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No WLP check-ins recorded this month.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">WLP King &amp; Queen</CardTitle>
          <Button size="sm" variant="outline" onClick={() => calc.mutate(month)} disabled={calc.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" /> Recalculate
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {winners.length ? (
            winners.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{w.wellness_members?.full_name}</span>
                <Badge>{w.reward_type === "wlp_king" ? "King" : "Queen"}</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Members attending all {totalWednesdays} Wednesday sessions appear here after recalculation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Revenue tab ---------------------------- */

export function RevenueTab() {
  const today = todayIst();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  const applyPreset = (value: string) => {
    setPreset(value);
    const now = new Date(`${today}T00:00:00`);
    if (value === "day") {
      setFrom(today);
      setTo(today);
    } else if (value === "week") {
      const start = new Date(now.getTime() - 6 * 86400000);
      setFrom(start.toISOString().slice(0, 10));
      setTo(today);
    } else if (value === "month") {
      setFrom(`${today.slice(0, 7)}-01`);
      setTo(today);
    }
  };

  const { data } = useRevenueReport(from, to);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Select value={preset} onValueChange={applyPreset}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="sm:w-40" />
        <Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="sm:w-40" />
        <Button
          variant="outline"
          disabled={!data?.rows.length}
          onClick={() =>
            downloadCsv(
              "revenue",
              ["Date", "Member", "Mobile", "Plan", "Membership", "Payment mode", "Amount"],
              (data?.rows ?? []).map((r) => [
                r.payment_date ?? r.start_date,
                r.wellness_members?.full_name ?? "",
                r.wellness_members?.mobile_number ?? "",
                r.wellness_plans?.name ?? "",
                r.membership_code,
                (r.payment_mode ?? "").split("+").map(paymentModeLabel).join(" + "),
                Number(r.price_paid ?? 0),
              ]),
            )
          }
        >
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total collected</p>
            <p className="text-2xl font-bold">{formatCurrency(data?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Payments</p>
            <p className="text-2xl font-bold">{data?.count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Average</p>
            <p className="text-2xl font-bold">
              {formatCurrency(data && data.count ? data.total / data.count : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">By payment mode</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_MODES.map((m) => {
            const entry = data?.byMode.find(([key]) => key === m.value);
            return (
              <div key={m.value} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{m.label}</span>
                <span className="font-medium">
                  {formatCurrency(entry?.[1].total ?? 0)}{" "}
                  <span className="text-muted-foreground">({entry?.[1].count ?? 0})</span>
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data?.rows.length ? (
            data.rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <span className="flex-1 font-medium">{r.wellness_members?.full_name}</span>
                <span className="text-muted-foreground">{r.wellness_plans?.name}</span>
                <Badge variant="outline">{(r.payment_mode ?? "").split("+").map(paymentModeLabel).join(" + ")}</Badge>
                <span className="text-muted-foreground">{formatDate(r.payment_date ?? r.start_date)}</span>
                <span className="font-semibold">{formatCurrency(Number(r.price_paid ?? 0))}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No payments in this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------- Page -------------------------------- */

export default function WellnessReports() {
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const [month, setMonth] = useState(
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthIst(),
  );
  useEffect(() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) setMonth(monthParam);
  }, [monthParam]);

  return (
    <div className="space-y-6">
      <PageBanner title="Events & Programs" description="Family Day, Lifestyle Day, MIW Challenge and WLP, month by month.">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </PageBanner>

      <Tabs defaultValue="family">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="family">Family Day</TabsTrigger>
          <TabsTrigger value="lifestyle">Lifestyle Day</TabsTrigger>
          <TabsTrigger value="miw">MIW Challenge</TabsTrigger>
          <TabsTrigger value="wlp">WLP King &amp; Queen</TabsTrigger>
        </TabsList>

        <TabsContent value="family" className="mt-4">
          <EventTab eventType="family_day" month={month} />
        </TabsContent>
        <TabsContent value="lifestyle" className="mt-4">
          <EventTab eventType="lifestyle_day" month={month} />
        </TabsContent>
        <TabsContent value="miw" className="mt-4">
          <MiwTab />
        </TabsContent>
        <TabsContent value="wlp" className="mt-4">
          <WlpTab month={month} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
