import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DobInput } from "@/components/ui/dob-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MEMBER_GOALS } from "@/lib/goals";

const TITLE = "Free Trial — All In One Wellness Family Health Club";
const DESCRIPTION =
  "Register for a free trial at All In One Wellness Family Health Club. Share your details and our team will contact you.";

export default function PublicTrial() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    mobile_number: "",
    gender: "",
    date_of_birth: "",
    city: "",
    area: "",
    goal: "weight_loss",
    height: "",
    joining_weight: "",
    health_issues: "",
    website: "",
  });

  useEffect(() => {
    document.title = TITLE;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", DESCRIPTION);
  }, []);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const digits = form.mobile_number.replace(/\D/g, "");
  const valid = form.full_name.trim().length > 1 && digits.length >= 10 && digits.length <= 12;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.website) return;
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("submit_trial_lead", {
        p_full_name: form.full_name,
        p_mobile_number: form.mobile_number,
        p_gender: form.gender || undefined,
        p_date_of_birth: form.date_of_birth || undefined,
        p_city: form.city || undefined,
        p_area: form.area || undefined,
        p_goal: form.goal || undefined,
        p_height: form.height || undefined,
        p_joining_weight: form.joining_weight || undefined,
        p_health_issues: form.health_issues || undefined,
      });
      if (rpcError) throw new Error(rpcError.message);
      const result = data as { ok?: boolean };
      if (!result?.ok) throw new Error("We could not save your details. Please try again.");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 p-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-xl font-semibold">Thank you, {form.full_name.split(" ")[0]}!</h1>
            <p className="text-sm text-muted-foreground">
              Your free trial request has been received. Our team will contact you on WhatsApp to schedule your trial.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-16 w-16" />
          <h1 className="text-2xl font-bold">Free Trial Registration</h1>
          <p className="text-sm text-muted-foreground">
            Fill in your details below to register for a free trial. Our team will reach out to schedule your visit.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="pt-name">Full name *</Label>
                <Input
                  id="pt-name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => set("full_name")(e.target.value)}
                  placeholder="Priya Sharma"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-mobile">WhatsApp number *</Label>
                <Input
                  id="pt-mobile"
                  inputMode="tel"
                  maxLength={15}
                  value={form.mobile_number}
                  onChange={(e) => set("mobile_number")(e.target.value)}
                  placeholder="98765 43210"
                  required
                />
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
                <Label htmlFor="pt-dob">Date of birth</Label>
                <DobInput id="pt-dob" value={form.date_of_birth} onChange={set("date_of_birth")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-city">City</Label>
                <Input
                  id="pt-city"
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-area">Local area</Label>
                <Input
                  id="pt-area"
                  maxLength={100}
                  value={form.area}
                  onChange={(e) => set("area")(e.target.value)}
                  placeholder="e.g. Vijay Nagar, Palasia"
                />
              </div>
              <div className="space-y-2">
                <Label>Your goal</Label>
                <Select value={form.goal} onValueChange={set("goal")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MEMBER_GOALS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-height">Height (cm)</Label>
                <Input
                  id="pt-height"
                  inputMode="decimal"
                  value={form.height}
                  onChange={(e) => set("height")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-weight">Current weight (kg)</Label>
                <Input
                  id="pt-weight"
                  inputMode="decimal"
                  value={form.joining_weight}
                  onChange={(e) => set("joining_weight")(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="pt-health">Any health issues? (optional)</Label>
                <Textarea
                  id="pt-health"
                  rows={3}
                  maxLength={1000}
                  value={form.health_issues}
                  onChange={(e) => set("health_issues")(e.target.value)}
                  placeholder="Thyroid, diabetes, knee pain…"
                />
              </div>

              {/* Honeypot */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
              />

              {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}

              <p className="sm:col-span-2 text-xs text-muted-foreground">
                By submitting this form you agree to be contacted by our team on WhatsApp or phone.
              </p>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={!valid || submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register for free trial
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
