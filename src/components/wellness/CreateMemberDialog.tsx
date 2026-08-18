import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateWellnessMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMemberDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const createMember = useCreateWellnessMember();
  const [form, setForm] = useState({
    full_name: "",
    mobile_number: "",
    email: "",
    gender: "",
    date_of_birth: "",
    goal: "",
    initial_weight: "",
    target_weight: "",
    height: "",
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!user) return;
    await createMember.mutateAsync({
      full_name: form.full_name.trim(),
      mobile_number: form.mobile_number.trim(),
      email: form.email.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      goal: form.goal || null,
      initial_weight: form.initial_weight ? Number(form.initial_weight) : null,
      current_weight: form.initial_weight ? Number(form.initial_weight) : null,
      target_weight: form.target_weight ? Number(form.target_weight) : null,
      height: form.height ? Number(form.height) : null,
      status: "lead",
      created_by: user.id,
    });
    setForm({
      full_name: "",
      mobile_number: "",
      email: "",
      gender: "",
      date_of_birth: "",
      goal: "",
      initial_weight: "",
      target_weight: "",
      height: "",
    });
    onOpenChange(false);
  };

  const valid = form.full_name.trim().length > 1 && /^[0-9+\s-]{10,15}$/.test(form.mobile_number.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add wellness member</DialogTitle>
          <DialogDescription>Capture the basics now — plans and progress can be added later.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="wm-name">Full name</Label>
            <Input id="wm-name" value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} placeholder="Priya Sharma" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-mobile">Mobile number</Label>
            <Input id="wm-mobile" value={form.mobile_number} onChange={(e) => set("mobile_number")(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-email">Email (optional)</Label>
            <Input id="wm-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
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
            <Label htmlFor="wm-dob">Date of birth</Label>
            <Input id="wm-dob" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} />
          </div>
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
            <Label htmlFor="wm-weight">Current weight (kg)</Label>
            <Input id="wm-weight" inputMode="decimal" value={form.initial_weight} onChange={(e) => set("initial_weight")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-target">Target weight (kg)</Label>
            <Input id="wm-target" inputMode="decimal" value={form.target_weight} onChange={(e) => set("target_weight")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-height">Height (cm)</Label>
            <Input id="wm-height" inputMode="decimal" value={form.height} onChange={(e) => set("height")(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || createMember.isPending}>Add member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
