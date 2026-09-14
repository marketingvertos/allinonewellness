import { useEffect, useState } from "react";
import { WellnessMember, useUpdateWellnessMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DobInput } from "@/components/ui/dob-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TagPicker } from "./TagPicker";
import { BatchPicker } from "./BatchPicker";
import { ReferrerPicker } from "./ReferrerPicker";

const GOALS = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "fat_loss", label: "Fat loss" },
  { value: "weight_management", label: "Weight management" },
  { value: "weight_gain", label: "Weight gain" },
  { value: "general_wellness", label: "General wellness" },
  { value: "healthy_lifestyle", label: "Healthy lifestyle" },
  { value: "body_transformation", label: "Body transformation" },
];

interface Props {
  member: WellnessMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function EditMemberDialog({ member, open, onOpenChange }: Props) {
  const updateMember = useUpdateWellnessMember();
  const [tags, setTags] = useState<string[]>(member.tags ?? []);
  const [batchId, setBatchId] = useState<string | null>(member.batch_id ?? null);
  const [referrerId, setReferrerId] = useState<string | null>(
    (member as { referred_by_member_id?: string | null }).referred_by_member_id ?? null,
  );
  const [form, setForm] = useState({
    member_mode: member.member_mode ?? "physical",
    full_name: member.full_name ?? "",
    mobile_number: member.mobile_number ?? "",
    email: member.email ?? "",
    gender: member.gender ?? "",
    date_of_birth: member.date_of_birth ?? "",
    joining_date: member.joining_date ?? "",
    marital_status: (member as { marital_status?: string | null }).marital_status ?? "",
    anniversary_date: (member as { anniversary_date?: string | null }).anniversary_date ?? "",
    goal: member.goal ?? "",
    current_weight: num(member.current_weight),
    target_weight: num(member.target_weight),
    height: num(member.height),
  });

  // Reload the form whenever the panel opens or switches to another member.
  useEffect(() => {
    if (!open) return;
    setTags(member.tags ?? []);
    setBatchId(member.batch_id ?? null);
    setReferrerId((member as { referred_by_member_id?: string | null }).referred_by_member_id ?? null);
    setForm({
      member_mode: member.member_mode ?? "physical",
      full_name: member.full_name ?? "",
      mobile_number: member.mobile_number ?? "",
      email: member.email ?? "",
      gender: member.gender ?? "",
      date_of_birth: member.date_of_birth ?? "",
      joining_date: member.joining_date ?? "",
      marital_status: (member as { marital_status?: string | null }).marital_status ?? "",
      anniversary_date: (member as { anniversary_date?: string | null }).anniversary_date ?? "",
      goal: member.goal ?? "",
      current_weight: num(member.current_weight),
      target_weight: num(member.target_weight),
      height: num(member.height),
    });
  }, [open, member]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const valid =
    form.full_name.trim().length > 1 && /^[0-9+\s-]{10,15}$/.test(form.mobile_number.trim());

  const save = async () => {
    await updateMember.mutateAsync({
      id: member.id,
      member_mode: form.member_mode,
      full_name: form.full_name.trim(),
      mobile_number: form.mobile_number.trim(),
      email: form.email.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      joining_date: form.joining_date || member.joining_date,
      marital_status: form.marital_status || null,
      anniversary_date: form.marital_status === "married" ? form.anniversary_date || null : null,
      goal: form.goal || null,
      current_weight: form.current_weight ? Number(form.current_weight) : null,
      target_weight: form.target_weight ? Number(form.target_weight) : null,
      height: form.height ? Number(form.height) : null,
      tags,
      batch_id: batchId,
      referred_by_member_id: referrerId,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      description="Update this member's details. Changes save when you press Save."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || updateMember.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label>Member type</Label>
          <ToggleGroup
            type="single"
            value={form.member_mode}
            onValueChange={(v) => v && set("member_mode")(v)}
            className="justify-start gap-2"
          >
            <ToggleGroupItem value="physical" className="flex-1 sm:flex-none">Physical</ToggleGroupItem>
            <ToggleGroupItem value="virtual" className="flex-1 sm:flex-none">Virtual</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="em-name">Full name</Label>
          <Input id="em-name" value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-mobile">Mobile number</Label>
          <Input id="em-mobile" value={form.mobile_number} onChange={(e) => set("mobile_number")(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            The member's login ID stays the same until their login is reset.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-email">Email (optional)</Label>
          <Input id="em-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={set("gender")}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-dob">Date of birth</Label>
          <DobInput id="em-dob" value={form.date_of_birth} onChange={set("date_of_birth")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-join">Joining date</Label>
          <Input id="em-join" type="date" value={form.joining_date} onChange={(e) => set("joining_date")(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Relationship status</Label>
          <Select value={form.marital_status} onValueChange={set("marital_status")}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married</SelectItem>
              <SelectItem value="prefer_not_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.marital_status === "married" && (
          <div className="space-y-2">
            <Label htmlFor="em-anniv">Anniversary date</Label>
            <Input id="em-anniv" type="date" value={form.anniversary_date} onChange={(e) => set("anniversary_date")(e.target.value)} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Goal</Label>
          <Select value={form.goal} onValueChange={set("goal")}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {GOALS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-weight">Current weight (kg)</Label>
          <Input id="em-weight" inputMode="decimal" value={form.current_weight} onChange={(e) => set("current_weight")(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-target">Target weight (kg)</Label>
          <Input id="em-target" inputMode="decimal" value={form.target_weight} onChange={(e) => set("target_weight")(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="em-height">Height (cm)</Label>
          <Input id="em-height" inputMode="decimal" value={form.height} onChange={(e) => set("height")(e.target.value)} />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label>Tags</Label>
          <TagPicker value={tags} onChange={setTags} idPrefix="em-tag" />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label>Batch</Label>
          <BatchPicker value={batchId} onChange={setBatchId} />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label>Referred by / helped by</Label>
          <ReferrerPicker value={referrerId} excludeId={member.id} onChange={setReferrerId} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
