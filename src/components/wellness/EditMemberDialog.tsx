import { useEffect, useState } from "react";
import { WellnessMember, WellnessStatus, useUpdateWellnessMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BatchPicker } from "./BatchPicker";
import { TagPicker } from "./TagPicker";
import { DobInput } from "@/components/ui/dob-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryPicker } from "./CategoryPicker";
import { statusLabel } from "./status";

const STATUSES: WellnessStatus[] = ["lead", "trial", "active_member", "renewal_due", "expired", "inactive"];

interface Props {
  member: WellnessMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMemberDialog({ member, open, onOpenChange }: Props) {
  const update = useUpdateWellnessMember();
  const [form, setForm] = useState({
    member_mode: member.member_mode ?? "physical",
    full_name: member.full_name,
    mobile_number: member.mobile_number,
    email: member.email ?? "",
    gender: member.gender ?? "",
    date_of_birth: member.date_of_birth ?? "",
    marital_status: member.marital_status ?? "",
    anniversary_date: member.anniversary_date ?? "",
    initial_weight: member.initial_weight?.toString() ?? "",
    current_weight: member.current_weight?.toString() ?? "",
    target_weight: member.target_weight?.toString() ?? "",
    height: member.height?.toString() ?? "",
    status: member.status as WellnessStatus,
  });
  const [batchId, setBatchId] = useState<string | null>(member.batch_id);
  const [categoryId, setCategoryId] = useState<string | null>(member.category_id ?? null);
  const [tags, setTags] = useState<string[]>(member.tags ?? []);

  useEffect(() => {
    if (!open) return;
    setTags(member.tags ?? []);
    setForm({
      member_mode: member.member_mode ?? "physical",
      full_name: member.full_name,
      mobile_number: member.mobile_number,
      email: member.email ?? "",
      gender: member.gender ?? "",
      date_of_birth: member.date_of_birth ?? "",
      marital_status: member.marital_status ?? "",
      anniversary_date: member.anniversary_date ?? "",
      initial_weight: member.initial_weight?.toString() ?? "",
      current_weight: member.current_weight?.toString() ?? "",
      target_weight: member.target_weight?.toString() ?? "",
      height: member.height?.toString() ?? "",
      status: member.status,
    });
    setBatchId(member.batch_id);
    setCategoryId(member.category_id ?? null);
  }, [open, member]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const valid = form.full_name.trim().length > 1 && /^[0-9+\s-]{10,15}$/.test(form.mobile_number.trim());

  const submit = async () => {
    await update.mutateAsync({
      id: member.id,
      member_mode: form.member_mode,
      tags,
      full_name: form.full_name.trim(),
      mobile_number: form.mobile_number.trim(),
      email: form.email.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      marital_status: form.marital_status || null,
      anniversary_date: form.marital_status === "married" ? form.anniversary_date || null : null,
      initial_weight: form.initial_weight ? Number(form.initial_weight) : null,
      current_weight: form.current_weight ? Number(form.current_weight) : null,
      target_weight: form.target_weight ? Number(form.target_weight) : null,
      height: form.height ? Number(form.height) : null,
      status: form.status,
      batch_id: batchId,
      category_id: categoryId,
    } as never);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit member"
      description="Update this member's details, category and status."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || update.isPending}>Save changes</Button>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="em-email">Email</Label>
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
          <Label htmlFor="em-start">Starting weight (kg)</Label>
          <Input id="em-start" inputMode="decimal" value={form.initial_weight} onChange={(e) => set("initial_weight")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="em-current">Current weight (kg)</Label>
          <Input id="em-current" inputMode="decimal" value={form.current_weight} onChange={(e) => set("current_weight")(e.target.value)} />
          <p className="text-xs text-muted-foreground">Normally updated automatically by the latest recorded reading.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="em-target">Target weight (kg)</Label>
          <Input id="em-target" inputMode="decimal" value={form.target_weight} onChange={(e) => set("target_weight")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="em-height">Height (cm)</Label>
          <Input id="em-height" inputMode="decimal" value={form.height} onChange={(e) => set("height")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Tags</Label>
          <TagPicker value={tags} onChange={setTags} idPrefix="em-tag" />
        </div>
        <div className="space-y-2">
          <Label>Batch</Label>
          <BatchPicker value={batchId} onChange={setBatchId} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
