import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStartGuestTrial } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
}

const GUEST_DAYS = 3;

export function GuestTrialDialog({ open, onOpenChange, defaultName }: Props) {
  const { user } = useAuth();
  const startGuest = useStartGuestTrial();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState(today);

  useEffect(() => {
    if (open) {
      const seed = (defaultName ?? "").trim();
      const isNumber = /^\d+$/.test(seed);
      setName(isNumber ? "" : seed);
      setMobile(isNumber ? seed : "");
      setEmail("");
      setStartDate(today);
    }
  }, [open, defaultName, today]);

  const mobileDigits = mobile.replace(/\D/g, "");
  const valid = name.trim().length > 1 && mobileDigits.length >= 10;

  const submit = async () => {
    if (!user || !valid) return;
    await startGuest.mutateAsync({
      full_name: name,
      mobile_number: mobileDigits.slice(-10),
      email: email || null,
      start_date: startDate,
      created_by: user.id,
      duration_days: GUEST_DAYS,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a guest trial"
      description={`A ${GUEST_DAYS}-day free trial. The guest is not registered as a member — after the trial their scan will ask them to take a membership.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || startGuest.isPending}>
            Start guest trial
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="g-name">Full name</Label>
          <Input id="g-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-mobile">Mobile number</Label>
          <Input
            id="g-mobile"
            inputMode="numeric"
            maxLength={15}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-email">Email (optional)</Label>
          <Input id="g-email" type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-start">Start date</Label>
          <Input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Input value={`${GUEST_DAYS} days (free)`} readOnly disabled />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
