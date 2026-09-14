import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DobInput } from "@/components/ui/dob-input";
import { CheckCircle2, Loader2 } from "lucide-react";

const TITLE = "Join All In One Wellness — Family Health Club";
const DESCRIPTION =
  "Register with All In One Wellness Family Health Club. Share your details and our team will contact you on WhatsApp.";

export default function PublicRegister() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    mobile_number: "",
    alternate_mobile: "",
    date_of_birth: "",
    anniversary_date: "",
    city: "",
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

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const digits = form.mobile_number.replace(/\D/g, "");
  const valid = form.full_name.trim().length > 1 && digits.length >= 10 && digits.length <= 12;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("public-register", {
        body: form,
      });
      if (fnError) {
        const ctx = (fnError as { context?: Response }).context;
        let message = "We could not save your details. Please try again.";
        try {
          const body = await ctx?.clone().json();
          if (body?.error) message = String(body.error);
        } catch {
          /* keep the default message */
        }
        throw new Error(message);
      }
      if (!(data as { ok?: boolean })?.ok) throw new Error("We could not save your details. Please try again.");
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
              Your registration has been received. Our team will contact you on WhatsApp shortly.
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
          <h1 className="text-2xl font-bold">All In One Wellness — Family Health Club</h1>
          <p className="text-sm text-muted-foreground">
            Fill in your details below and our team will reach out to you on WhatsApp.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration form</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="pr-name">Full name *</Label>
                <Input
                  id="pr-name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => set("full_name")(e.target.value)}
                  placeholder="Priya Sharma"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-mobile">WhatsApp number *</Label>
                <Input
                  id="pr-mobile"
                  inputMode="tel"
                  maxLength={15}
                  value={form.mobile_number}
                  onChange={(e) => set("mobile_number")(e.target.value)}
                  placeholder="98765 43210"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-alt">Alternate mobile number</Label>
                <Input
                  id="pr-alt"
                  inputMode="tel"
                  maxLength={15}
                  value={form.alternate_mobile}
                  onChange={(e) => set("alternate_mobile")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-dob">Date of birth</Label>
                <DobInput id="pr-dob" value={form.date_of_birth} onChange={set("date_of_birth")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-doa">Anniversary date</Label>
                <DobInput
                  id="pr-doa"
                  value={form.anniversary_date}
                  onChange={set("anniversary_date")}
                  showAge={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-city">City</Label>
                <Input
                  id="pr-city"
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-height">Height (cm)</Label>
                <Input
                  id="pr-height"
                  inputMode="decimal"
                  value={form.height}
                  onChange={(e) => set("height")(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="pr-weight">Your weight when joining the club (kg)</Label>
                <Input
                  id="pr-weight"
                  inputMode="decimal"
                  value={form.joining_weight}
                  onChange={(e) => set("joining_weight")(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="pr-health">Any health issues?</Label>
                <Textarea
                  id="pr-health"
                  rows={3}
                  maxLength={1000}
                  value={form.health_issues}
                  onChange={(e) => set("health_issues")(e.target.value)}
                  placeholder="Thyroid, diabetes, knee pain…"
                />
              </div>

              {/* Honeypot — hidden from people, tempting for bots. */}
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
                  Submit registration
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
