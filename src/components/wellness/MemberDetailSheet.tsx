import { useEffect, useState } from "react";
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

  useServingLedger,
  useWeightHistory,
  useWellnessPlans,
  useBodyMeasurements,
  useUpdateWellnessMember,
  useWellnessMember,
  useDeleteWeightEntry,
  useDeleteBodyMeasurement,
  useIsWellnessManager,
  BodyMeasurement,
} from "@/hooks/useWellness";
import { MemberDashboard } from "./MemberDashboard";
import { RecordMeasurementDialog } from "./RecordMeasurementDialog";
import { EditWeightEntryDialog, WeightEntry } from "./EditWeightEntryDialog";
import { AchievementsPanel } from "./AchievementsPanel";
import { ReferrerPicker } from "./ReferrerPicker";
import { BatchPicker } from "./BatchPicker";
import { StartTrialDialog } from "./StartTrialDialog";
import { RenewPlanDialog } from "./RenewPlanDialog";
import { SwitchPlanDialog } from "./SwitchPlanDialog";
import { MemberLoginCard } from "./MemberLoginCard";
import { SendWhatsAppDialog } from "@/components/wellness/SendWhatsAppDialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PinkCardPanel } from "@/components/wellness/PinkCardPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { statusLabel, statusVariant } from "./status";
import { ModeBadge, TagBadges } from "./memberMeta";
import { DobInput } from "@/components/ui/dob-input";
import { ageFromDob } from "@/lib/formatters";

interface Props {
  member: WellnessMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberDetailSheet({ member: memberProp, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const memberId = memberProp?.id;
  const { data: liveMember } = useWellnessMember(memberId);
  const member = liveMember ?? memberProp;


  const { data: plans } = useWellnessPlans();
  const { data: trials } = useMemberTrials(memberId);
  const { data: memberships } = useMemberships(memberId);
  const { data: attendance } = useMemberAttendance(memberId);
  const { data: ledger } = useServingLedger(memberId);
  const { data: weights } = useWeightHistory(memberId);
  const { data: notes } = useMemberNotes(memberId);
  const { data: measurements } = useBodyMeasurements(memberId);
  const updateMember = useUpdateWellnessMember();

  const createMembership = useCreateMembership();
  const adjustServings = useAdjustServings();
  const checkIn = useCheckIn();
  const addWeight = useAddWeight();
  const deleteWeight = useDeleteWeightEntry();
  const deleteMeasurement = useDeleteBodyMeasurement();
  const isManager = useIsWellnessManager();
  const addNote = useAddMemberNote();

  const [planId, setPlanId] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [dob, setDob] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [editMeasurement, setEditMeasurement] = useState<BodyMeasurement | null>(null);
  const [editWeight, setEditWeight] = useState<WeightEntry | null>(null);
  const [weightDate, setWeightDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "weight" | "measurement"; id: string } | null>(null);
  const [referrerDraft, setReferrerDraft] = useState<string | null | undefined>(undefined);
  const [trialOpen, setTrialOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  // Clear any pending referrer selection when the panel switches member.
  useEffect(() => {
    setReferrerDraft(undefined);
  }, [memberId]);

  if (!member) return null;

  const currentReferrer = (member as { referred_by_member_id?: string | null }).referred_by_member_id ?? null;
  const referrerValue = referrerDraft === undefined ? currentReferrer : referrerDraft;

  const istToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayVisit = attendance?.find((a) => a.visit_date === istToday);

  const activeTrial = trials?.find((t) => t.status === "active");
  const activeMembership = memberships?.find((m) => m.status === "active" || m.status === "expiring_soon");
  const usedPct = activeMembership
    ? Math.round((activeMembership.used_servings / Math.max(activeMembership.total_servings, 1)) * 100)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {member.full_name}
            <Badge variant={statusVariant(member.status)}>{statusLabel(member.status)}</Badge>
            <ModeBadge mode={member.member_mode} />
            <TagBadges tags={member.tags} />
          </SheetTitle>
          <SheetDescription>
            {member.mobile_number} · Joined {formatDate(member.joining_date)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {todayVisit ? (
            <Badge variant="secondary" className="w-fit py-1.5">
              Checked in today · {formatDateTime(todayVisit.visit_time)}
            </Badge>
          ) : (
            <Button onClick={() => checkIn.mutate({ memberId: member.id })} disabled={checkIn.isPending}>
              Check in today
            </Button>
          )}
          {!activeTrial && !activeMembership && (
            <Button variant="outline" onClick={() => setTrialOpen(true)}>
              Start trial
            </Button>
          )}
          <Button variant="outline" onClick={() => setWhatsAppOpen(true)}>
            Send WhatsApp
          </Button>
        </div>

        <SendWhatsAppDialog
          memberId={member.id}
          memberName={member.full_name}
          mobileNumber={member.mobile_number}
          open={whatsAppOpen}
          onOpenChange={setWhatsAppOpen}
        />

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="servings">Servings</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="pinkcard">Pink Card</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            <MemberDashboard
              member={member}
              membership={activeMembership}
              weights={weights ?? []}
              attendance={attendance ?? []}
              measurements={measurements ?? []}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Date of birth</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">

                  <div className="flex-1">
                    <DobInput
                      value={dob ?? member.date_of_birth ?? ""}
                      onChange={(v) => setDob(v)}
                      showAge={false}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!dob || dob === member.date_of_birth || updateMember.isPending}
                    onClick={() => dob && updateMember.mutate({ id: member.id, date_of_birth: dob })}
                  >
                    Save
                  </Button>
                </div>
                {ageFromDob(dob ?? member.date_of_birth) !== null && (
                  <p className="mt-2 text-sm font-medium">Age: {ageFromDob(dob ?? member.date_of_birth)} years</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Used for birthday reminders on the overview page.</p>
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <MemberLoginCard memberId={member.id} mobileNumber={member.mobile_number} />
                {!(member as { user_id?: string | null }).user_id && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Or share this self-activation code:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {(member as { activation_code?: string }).activation_code ?? "—"}
                    </span>
                  </p>
                )}
              </div>


              <div className="rounded-lg border p-4 text-sm sm:col-span-2">
                <p className="font-medium">Batch</p>
                <div className="mt-2">
                  <BatchPicker
                    value={member.batch_id}
                    onChange={(id) => updateMember.mutate({ id: member.id, batch_id: id })}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-4 text-sm sm:col-span-2">
                <p className="font-medium">Referred by / helped by</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <ReferrerPicker
                    value={referrerValue}
                    excludeId={member.id}
                    onChange={(id) => setReferrerDraft(id)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={referrerValue === currentReferrer || updateMember.isPending}
                    onClick={() =>
                      updateMember.mutate({ id: member.id, referred_by_member_id: referrerValue })
                    }
                  >
                    Save
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Credits the selected member with helping this person join.
                </p>
              </div>
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
                  <Button size="sm" onClick={() => setRenewOpen(true)}>
                    Renew
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSwitchOpen(true)}>
                    Switch plan
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
                  <div key={m.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{m.wellness_plans?.name ?? m.membership_code}</span>
                    <span className="text-xs text-muted-foreground sm:text-sm">
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
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span>{formatDateTime(a.visit_time)}</span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground sm:text-sm">
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

          <TabsContent value="pinkcard" className="space-y-4 pt-4">
            <PinkCardPanel memberId={member.id} balance={member.pink_card_balance} />
          </TabsContent>

          <TabsContent value="progress" className="space-y-4 pt-4">
            <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="wm-new-weight">Record weight (kg)</Label>
                <Input id="wm-new-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2 sm:w-44">
                <Label htmlFor="wm-new-weight-date">Date</Label>
                <Input id="wm-new-weight-date" type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} />
              </div>
              <Button
                className="w-full sm:w-auto"
                disabled={!weight || !weightDate || !user}
                onClick={async () => {
                  if (!user) return;
                  await addWeight.mutateAsync({
                    member_id: member.id,
                    weight: Number(weight),
                    recorded_date: weightDate,
                    recorded_by: user.id,
                  });
                  setWeight("");
                  setWeightDate(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
                }}
              >
                Save
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Body measurements</p>
                <p className="text-xs text-muted-foreground">
                  {measurements?.length ? `${measurements.length} recorded` : "None recorded yet"}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditMeasurement(null);
                  setMeasureOpen(true);
                }}
              >
                Record measurements
              </Button>
            </div>

            {measurements?.length ? (
              <div className="space-y-2">
                {[...measurements].reverse().map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span>{formatDate(m.recorded_date)}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-right text-xs text-muted-foreground sm:text-sm">
                        {[m.waist && `W ${m.waist}`, m.hip && `H ${m.hip}`, m.chest && `C ${m.chest}`,
                          m.body_fat_percentage && `Fat ${m.body_fat_percentage}%`].filter(Boolean).join(" · ")}
                      </span>
                      {isManager && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Edit measurements"
                            onClick={() => {
                              setEditMeasurement(m);
                              setMeasureOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            aria-label="Delete measurements"
                            onClick={() => setConfirmDelete({ kind: "measurement", id: m.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {weights?.length ? (
              <div className="space-y-2">
                {[...weights].reverse().map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span>{formatDate(w.recorded_date)}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{w.weight} kg</span>
                      {isManager && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Edit reading"
                            onClick={() => setEditWeight(w)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            aria-label="Delete reading"
                            onClick={() => setConfirmDelete({ kind: "weight", id: w.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weight readings yet.</p>
            )}
            {!isManager && (
              <p className="text-xs text-muted-foreground">
                Only admins and managers can correct or remove existing records.
              </p>
            )}
          </TabsContent>

          <TabsContent value="achievements" className="pt-4">
            <AchievementsPanel member={member} weights={weights ?? []} />
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
        </div>

        <RecordMeasurementDialog
        memberId={member.id}
        entry={editMeasurement}
        open={measureOpen}
        onOpenChange={(o) => {
          setMeasureOpen(o);
          if (!o) setEditMeasurement(null);
        }}
      />
      <EditWeightEntryDialog
        memberId={member.id}
        entry={editWeight}
        open={!!editWeight}
        onOpenChange={(o) => !o && setEditWeight(null)}
      />
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the record permanently and recalculates the member's progress and badges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                if (confirmDelete.kind === "weight") {
                  await deleteWeight.mutateAsync({ id: confirmDelete.id, member_id: member.id });
                } else {
                  await deleteMeasurement.mutateAsync(confirmDelete.id);
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        <StartTrialDialog member={member} open={trialOpen} onOpenChange={setTrialOpen} />
        {activeMembership && (
          <>
            <RenewPlanDialog membership={activeMembership} open={renewOpen} onOpenChange={setRenewOpen} />
            <SwitchPlanDialog membership={activeMembership} open={switchOpen} onOpenChange={setSwitchOpen} />
          </>
        )}
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
