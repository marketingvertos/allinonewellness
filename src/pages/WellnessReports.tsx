import { useMemo, useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { ScheduleEventDialog } from "@/components/wellness/ScheduleEventDialog";
import {
  EventType,
  currentMonthIst,
  monthLabel,
  recentMonths,
  useCalcMonthlyRewards,
  useDeleteEvent,
  useEventParticipants,
  useMonthlyRewards,
  useRemoveParticipant,
  useSaveParticipant,
  useToggleWlpAttendance,
  useWellnessEvents,
  useWlpAttendance,
} from "@/hooks/useEvents";
import { PAYMENT_MODES, paymentModeLabel, useMilestoneHolders, useRevenueReport } from "@/hooks/useReports";
import { useWellnessMembers } from "@/hooks/useWellness";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, todayIst } from "@/lib/formatters";
import { CalendarDays, Download, Plus, RefreshCw, Trash2 } from "lucide-react";

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {recentMonths(12).map((m) => (
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

/* ------------------------------- MIW tab ------------------------------ */

function MiwTab({ month }: { month: string }) {
  const { data: events } = useWellnessEvents(month, "miw_challenge");
  const event = events?.[0] ?? null;
  const [open, setOpen] = useState(false);
  const { data: participants } = useEventParticipants(event?.id);
  const saveParticipant = useSaveParticipant();
  const removeParticipant = useRemoveParticipant();
  const { data: members } = useWellnessMembers("", "all");
  const [memberId, setMemberId] = useState("");
  const [startWeight, setStartWeight] = useState("");

  const add = async () => {
    if (!event || !memberId) return;
    await saveParticipant.mutateAsync({
      event_id: event.id,
      member_id: memberId,
      start_weight: startWeight ? Number(startWeight) : null,
    });
    setMemberId("");
    setStartWeight("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">MIW Challenge (21 days) — {monthLabel(month)}</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>{event ? "Edit" : "Start challenge"}</Button>
        </CardHeader>
        <CardContent className="text-sm">
          {event ? (
            <p>
              {formatDate(event.event_date)}
              {event.end_date ? ` — ${formatDate(event.end_date)}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">No challenge running this month.</p>
          )}
        </CardContent>
      </Card>

      {event && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">Participants</CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!participants?.length}
              onClick={() =>
                downloadCsv(
                  "miw-challenge",
                  ["Name", "Mobile", "Start weight", "Current weight", "Change"],
                  (participants ?? []).map((p) => [
                    p.wellness_members?.full_name ?? "",
                    p.wellness_members?.mobile_number ?? "",
                    p.start_weight ?? "",
                    p.end_weight ?? "",
                    p.start_weight != null && p.end_weight != null
                      ? (Number(p.end_weight) - Number(p.start_weight)).toFixed(1)
                      : "",
                  ]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {(members ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Start weight"
                inputMode="decimal"
                value={startWeight}
                onChange={(e) => setStartWeight(e.target.value)}
              />
              <Button onClick={add} disabled={!memberId || saveParticipant.isPending}>Add</Button>
            </div>

            <div className="space-y-2">
              {(participants ?? []).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
                  <span className="flex-1 font-medium">{p.wellness_members?.full_name}</span>
                  <span className="text-muted-foreground">Start {p.start_weight ?? "—"} kg</span>
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    placeholder="Current"
                    defaultValue={p.end_weight ?? ""}
                    onBlur={(e) =>
                      saveParticipant.mutate({
                        id: p.id,
                        event_id: p.event_id,
                        member_id: p.member_id,
                        start_weight: p.start_weight,
                        end_weight: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeParticipant.mutate(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!participants?.length && (
                <p className="text-sm text-muted-foreground">No participants added yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ScheduleEventDialog
        eventType="miw_challenge"
        month={month}
        existing={event}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

/* ------------------------------- WLP tab ------------------------------ */

function WlpTab({ month }: { month: string }) {
  const { data: attendance } = useWlpAttendance(month);
  const toggle = useToggleWlpAttendance();
  const { data: rewards } = useMonthlyRewards(month);
  const calc = useCalcMonthlyRewards();
  const { data: members } = useWellnessMembers("", "all");
  const coaches = (members ?? []).filter((m) => (m.tags ?? []).includes("coach"));
  const [sessionDate, setSessionDate] = useState(todayIst());

  const sessions = useMemo(() => {
    const dates = new Set((attendance ?? []).map((a) => a.session_date));
    return [...dates].sort();
  }, [attendance]);

  const countFor = (memberId: string) =>
    (attendance ?? []).filter((a) => a.member_id === memberId).length;
  const rowFor = (memberId: string) =>
    (attendance ?? []).find((a) => a.member_id === memberId && a.session_date === sessionDate);

  const winners = (rewards ?? []).filter(
    (r) => r.reward_type === "wlp_king" || r.reward_type === "wlp_queen",
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">WLP sessions — {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="wlp-date">Session date</Label>
              <Input
                id="wlp-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground sm:pb-2">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} recorded this month
            </p>
          </div>

          <div className="space-y-2">
            {coaches.length ? (
              coaches.map((c) => {
                const row = rowFor(c.id);
                const total = countFor(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
                  >
                    <Checkbox
                      checked={!!row}
                      onCheckedChange={() =>
                        toggle.mutate({
                          memberId: c.id,
                          sessionDate,
                          existingId: row?.id ?? null,
                        })
                      }
                    />
                    <span className="flex-1 font-medium">{c.full_name}</span>
                    <Badge variant={total >= 4 ? "default" : "outline"}>{total} this month</Badge>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No members are tagged as coaches yet.</p>
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
              Coaches attending 4 or more sessions this month appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- Revenue tab ---------------------------- */

function RevenueTab() {
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
                paymentModeLabel(r.payment_mode),
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
                <Badge variant="outline">{paymentModeLabel(r.payment_mode)}</Badge>
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
  const [month, setMonth] = useState(currentMonthIst());

  return (
    <div className="space-y-6">
      <PageBanner title="Reports" description="Events, rewards and money, month by month.">
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
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="family" className="mt-4">
          <EventTab eventType="family_day" month={month} />
        </TabsContent>
        <TabsContent value="lifestyle" className="mt-4">
          <EventTab eventType="lifestyle_day" month={month} />
        </TabsContent>
        <TabsContent value="miw" className="mt-4">
          <MiwTab month={month} />
        </TabsContent>
        <TabsContent value="wlp" className="mt-4">
          <WlpTab month={month} />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <RevenueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
