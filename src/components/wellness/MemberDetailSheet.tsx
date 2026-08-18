import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  WellnessMember,
  useMemberAttendance,
  useMemberNotes,
  useMemberTrials,
  useMemberships,
  useAddMemberNote,
  useAddWeight,
  useAdjustServings,
  useCheckIn,
  useCreateMembership,
  useRenewMembership,
  useServingLedger,
  useStartTrial,
  useWeightHistory,
  useWellnessPlans,
} from "@/hooks/useWellness";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { statusLabel, statusVariant } from "./status";

interface Props {
  member: WellnessMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberDetailSheet({ member, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const memberId = member?.id;

  const { data: plans } = useWellnessPlans();
  const { data: trials } = useMemberTrials(memberId);
  const { data: memberships } = useMemberships(memberId);
  const { data: attendance } = useMemberAttendance(memberId);
  const { data: ledger } = useServingLedger(memberId);
  const { data: weights } = useWeightHistory(memberId);
  const { data: notes } = useMemberNotes(memberId);

  const startTrial = useStartTrial();
  const createMembership = useCreateMembership();
  const renewMembership = useRenewMembership();
  const adjustServings = useAdjustServings();
  const checkIn = useCheckIn();
  const addWeight = useAddWeight();
  const addNote = useAddMemberNote();

  const [planId, setPlanId] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  if (!member) return null;

  const activeTrial = trials?.find((t) => t.status === "active");
  const activeMembership = memberships?.find((m) => m.status === "active" || m.status === "expiring_soon");
  const usedPct = activeMembership
    ? Math.round((activeMembership.used_servings / Math.max(activeMembership.total_servings, 1)) * 100)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {member.full_name}
            <Badge variant={statusVariant(member.status)}>{statusLabel(member.status)}</Badge>
          </SheetTitle>
          <SheetDescription>
            {member.mobile_number} · Joined {formatDate(member.joining_date)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => checkIn.mutate({ memberId: member.id })} disabled={checkIn.isPending}>
            Check in today
          </Button>
          {!activeTrial && !activeMembership && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                user &&
                startTrial.mutate({
                  member_id: member.id,
                  duration_days: 3,
                  weight_at_start: member.current_weight,
                  created_by: user.id,
                })
              }
            >
              Start 3-day trial
            </Button>
          )}
        </div>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="servings">Servings</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="Goal" value={member.goal?.replace(/_/g, " ") ?? "—"} />
              <Detail label="Batch" value={member.wellness_batches?.name ?? "—"} />
              <Detail label="Starting weight" value={member.initial_weight ? `${member.initial_weight} kg` : "—"} />
              <Detail label="Current weight" value={member.current_weight ? `${member.current_weight} kg` : "—"} />
              <Detail label="Target weight" value={member.target_weight ? `${member.target_weight} kg` : "—"} />
              <Detail label="Height" value={member.height ? `${member.height} cm` : "—"} />
            </dl>
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">Member portal access</p>
              {(member as { user_id?: string | null }).user_id ? (
                <p className="text-muted-foreground">Portal login is active for this member.</p>
              ) : (
                <p className="text-muted-foreground">
                  Share this activation code so the member can activate the portal at /portal/auth:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {(member as { activation_code?: string }).activation_code ?? "—"}
                  </span>
                </p>
              )}
            </div>

            {activeTrial && (
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Trial in progress</p>
                <p className="text-muted-foreground">
                  {formatDate(activeTrial.start_date)} → {formatDate(activeTrial.end_date)}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="plan" className="space-y-4 pt-4">
            {activeMembership ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{activeMembership.wellness_plans?.name ?? "Membership"}</p>
                  <Badge variant={activeMembership.status === "expiring_soon" ? "destructive" : "secondary"}>
                    {activeMembership.status === "expiring_soon" ? "Renewal due" : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeMembership.membership_code} · {formatDate(activeMembership.start_date)} →{" "}
                  {formatDate(activeMembership.end_date)} · {formatCurrency(Number(activeMembership.price_paid))}
                </p>
                <Progress value={usedPct} />
                <p className="text-sm">
                  <span className="font-semibold">{activeMembership.remaining_servings}</span> of{" "}
                  {activeMembership.total_servings} servings remaining
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => renewMembership.mutate({ membershipId: activeMembership.id })}>
                    Renew
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustServings.mutate({ membershipId: activeMembership.id, change: 1, note: "Manual credit" })}
                  >
                    +1 serving
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustServings.mutate({ membershipId: activeMembership.id, change: -1, note: "Manual debit" })}
                  >
                    -1 serving
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">No active membership.</p>
                <div className="space-y-2">
                  <Label>Choose a plan</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(Number(p.price))} · {p.total_servings} servings
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!planId || createMembership.isPending}
                  onClick={() =>
                    createMembership.mutate({ memberId: member.id, planId, trialId: activeTrial?.id })
                  }
                >
                  {activeTrial ? "Convert trial to membership" : "Activate membership"}
                </Button>
              </div>
            )}

            {memberships && memberships.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">History</p>
                {memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{m.wellness_plans?.name ?? m.membership_code}</span>
                    <span className="text-muted-foreground">
                      {formatDate(m.start_date)} → {formatDate(m.end_date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-2 pt-4">
            {attendance?.length ? (
              attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{formatDateTime(a.visit_time)}</span>
                  <span className="text-muted-foreground">
                    {a.serving_deducted ? `1 serving · ${a.remaining_balance_snapshot} left` : "Trial visit"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
            )}
          </TabsContent>

          <TabsContent value="servings" className="space-y-2 pt-4">
            {ledger?.length ? (
              ledger.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="capitalize">{t.txn_type.replace(/_/g, " ")}</span>
                  <span className={t.change < 0 ? "text-muted-foreground" : "font-medium"}>
                    {t.change > 0 ? `+${t.change}` : t.change} → {t.balance_after}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No serving activity yet.</p>
            )}
          </TabsContent>

          <TabsContent value="progress" className="space-y-4 pt-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="wm-new-weight">Record weight (kg)</Label>
                <Input id="wm-new-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <Button
                disabled={!weight || !user}
                onClick={async () => {
                  if (!user) return;
                  await addWeight.mutateAsync({
                    member_id: member.id,
                    weight: Number(weight),
                    recorded_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
                    recorded_by: user.id,
                  });
                  setWeight("");
                }}
              >
                Save
              </Button>
            </div>
            {weights?.length ? (
              <div className="space-y-2">
                {[...weights].reverse().map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{formatDate(w.recorded_date)}</span>
                    <span className="font-medium">{w.weight} kg</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weight entries yet.</p>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (not visible to the member)" />
              <Button
                size="sm"
                disabled={!note.trim() || !user}
                onClick={async () => {
                  if (!user) return;
                  await addNote.mutateAsync({ member_id: member.id, note: note.trim(), created_by: user.id });
                  setNote("");
                }}
              >
                Add note
              </Button>
            </div>
            {notes?.map((n) => (
              <div key={n.id} className="rounded-md border p-3 text-sm">
                <p>{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 capitalize">{value}</dd>
    </div>
  );
}
