import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, UserPlus } from "lucide-react";

/** Shareable public registration link plus the team alert number. */
export function PublicRegistrationCard() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/join`;

  const { data: saved } = useQuery({
    queryKey: ["lead-alert-phone"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_credentials")
        .select("value")
        .eq("key", "lead_alert_phone")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });

  useEffect(() => {
    if (saved !== undefined) setPhone(saved ?? "");
  }, [saved]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("integration_credentials").upsert(
      {
        key: "lead_alert_phone",
        value: phone.trim(),
        updated_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Could not save the alert number");
      return;
    }
    qc.invalidateQueries({ queryKey: ["lead-alert-phone"] });
    toast.success(phone.trim() ? "Alert number saved" : "Alerts turned off");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" /> Public registration link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Registration form</p>
          <p className="mt-0.5 break-all text-xs text-muted-foreground">{url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/join" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-alert-phone">WhatsApp alert number (team)</Label>
          <div className="flex gap-2">
            <Input
              id="lead-alert-phone"
              inputMode="tel"
              maxLength={15}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button size="sm" onClick={save} disabled={saving}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Every new registration is sent here. Leave blank to turn alerts off.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Anyone can open this link — new entries appear in Members as leads.
        </p>
      </CardContent>
    </Card>
  );
}
