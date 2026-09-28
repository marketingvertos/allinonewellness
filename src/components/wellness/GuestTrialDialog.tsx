import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStartGuestTrial } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_MEMBER_PASSWORD } from "@/lib/memberAccess";
import { useToast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { ReferrerPicker } from "./ReferrerPicker";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
}

const TRIAL_OPTIONS = [
  { value: "1", label: "1 day · 1 serving" },
  { value: "3", label: "3 days · 3 servings" },
];

export function GuestTrialDialog({ open, onOpenChange, defaultName }: Props) {
  const { user } = useAuth();
  const startGuest = useStartGuestTrial();
  const { toast } = useToast();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [duration, setDuration] = useState("3");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [referrerMode, setReferrerMode] = useState<"member" | "other">("member");
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [otherMobile, setOtherMobile] = useState("");
  const [created, setCreated] = useState<{ mobile: string; loginError: string | null } | null>(null);



  useEffect(() => {
    if (open) {
      const seed = (defaultName ?? "").trim();
      const isNumber = /^\d+$/.test(seed);
      setName(isNumber ? "" : seed);
      setMobile(isNumber ? seed : "");
      setEmail("");
      setStartDate(today);
      setDuration("3");
      setHeight("");
      setWeight("");
      setReferrerMode("member");
      setReferrerId(null);
      setOtherName("");
      setOtherMobile("");
      setCreated(null);
    }
  }, [open, defaultName, today]);

  const mobileDigits = mobile.replace(/\D/g, "");
  const valid = name.trim().length > 1 && mobileDigits.length >= 10;
  const servings = Number(duration);

  const submit = async () => {
    if (!user || !valid) return;
    const digits = mobileDigits.slice(-10);
    const result = await startGuest.mutateAsync({
      full_name: name,
      mobile_number: digits,
      email: email || null,
      start_date: startDate,
      created_by: user.id,
      duration_days: servings,
      height: height ? Number(height) : null,
      weight: weight ? Number(weight) : null,
      referred_by_member_id: referrerMode === "member" ? referrerId : null,
      referrer_name: referrerMode === "other" ? otherName : null,
      referrer_mobile: referrerMode === "other" ? otherMobile : null,
    });

    setCreated({ mobile: digits, loginError: result.loginError });
  };

  const copyCredentials = () => {
    if (!created) return;
    navigator.clipboard.writeText(
      `Login ID: ${created.mobile}\nPassword: ${DEFAULT_MEMBER_PASSWORD}\nPortal: ${window.location.origin}/auth`,
    );
    toast({ title: "Credentials copied" });
  };

  if (created) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Guest trial started"
        description={
          created.loginError
            ? "The trial is saved, but the guest login could not be created automatically."
            : "The guest can now sign in to the portal with these details. They stay a guest, not a member."
        }
        footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
      >
        <div className="rounded-lg border p-4 space-y-3 text-sm">
          {created.loginError ? (
            <p className="text-destructive">{created.loginError}</p>
          ) : (
            <>
              <p className="font-medium">Guest login created</p>
              <p>
                Login ID: <span className="font-mono">{created.mobile}</span>
              </p>
              <p>
                Password: <span className="font-mono">{DEFAULT_MEMBER_PASSWORD}</span>
              </p>
              <Button variant="outline" size="sm" onClick={copyCredentials}>
                <Copy className="mr-2 h-4 w-4" /> Copy details
              </Button>
            </>
          )}
        </div>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a guest trial"
      description="A free trial on servings. The guest is not registered as a member — after the trial their scan will ask them to take a membership."
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
        <div className="sm:col-span-2 space-y-2">
          <Label>Free trial</Label>
          <ToggleGroup
            type="single"
            value={duration}
            onValueChange={(v) => v && setDuration(v)}
            className="justify-start flex-wrap"
          >
            {TRIAL_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} variant="outline" className="px-4">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {servings} free {servings === 1 ? "serving" : "servings"} — one serving per visit.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-start">Start date</Label>
          <Input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-height">Height (cm)</Label>
          <Input
            id="g-height"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g. 168"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-weight">Weight (kg)</Label>
          <Input
            id="g-weight"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 72.5"
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
