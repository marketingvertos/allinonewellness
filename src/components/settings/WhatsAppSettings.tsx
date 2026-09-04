import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useSaveWhatsAppSettings,
  useTestWhatsAppConnection,
  useWhatsAppSettings,
  type WhatsAppSettingsValues,
} from "@/hooks/useWhatsApp";
import { useIsWellnessManager } from "@/hooks/useWellness";

const EMPTY: WhatsAppSettingsValues = {
  whatsapp_api_url: "",
  whatsapp_api_key: "",
  whatsapp_vendor_uid: "",
  whatsapp_phone_number_id: "",
  whatsapp_verify_token: "",
  whatsapp_app_secret: "",
  whatsapp_default_language: "en",
  whatsapp_automation_enabled: "false",
};

export function WhatsAppSettings() {
  const isManager = useIsWellnessManager();
  const { data, isLoading } = useWhatsAppSettings();
  const save = useSaveWhatsAppSettings();
  const test = useTestWhatsAppConnection();

  const [form, setForm] = useState<WhatsAppSettingsValues>(EMPTY);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Test message from All In One Wellness.");

  // Hydrate from the server only once (and again right after a save), so a
  // background refresh never overwrites what is being typed.
  const hydratedRef = useRef(false);
  const [savedSnapshot, setSavedSnapshot] = useState<WhatsAppSettingsValues>(EMPTY);

  useEffect(() => {
    if (!data || hydratedRef.current) return;
    hydratedRef.current = true;
    const next = { ...EMPTY, ...data };
    setForm(next);
    setSavedSnapshot(next);
  }, [data]);

  const isDirty = useMemo(
    () => (Object.keys(EMPTY) as (keyof WhatsAppSettingsValues)[]).some((k) => form[k] !== savedSnapshot[k]),
    [form, savedSnapshot],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const set = (key: keyof WhatsAppSettingsValues, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () =>
    save.mutate(form, {
      onSuccess: () => setSavedSnapshot(form),
    });

  if (!isManager) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Business API</CardTitle>
          <CardDescription>Only admins and managers can view or change these settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Business API</CardTitle>
          <CardDescription>
            Use the same credentials as your other panel. They are stored securely and never exposed in the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-url">API base URL</Label>
              <Input
                id="wa-url"
                placeholder="https://panel.wachatsender.com/api/v1"
                value={form.whatsapp_api_url}
                onChange={(e) => set("whatsapp_api_url", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-key">Access token</Label>
              <Input
                id="wa-key"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={form.whatsapp_api_key}
                onChange={(e) => set("whatsapp_api_key", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-vendor">Vendor UID (WachatSender)</Label>
              <Input
                id="wa-vendor"
                value={form.whatsapp_vendor_uid}
                onChange={(e) => set("whatsapp_vendor_uid", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-pnid">Phone number ID (Meta Cloud)</Label>
              <Input
                id="wa-pnid"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => set("whatsapp_phone_number_id", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-verify">Webhook verify token</Label>
              <Input
                id="wa-verify"
                value={form.whatsapp_verify_token}
                onChange={(e) => set("whatsapp_verify_token", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-secret">App secret (signature check)</Label>
              <Input
                id="wa-secret"
                type="password"
                autoComplete="off"
                value={form.whatsapp_app_secret}
                onChange={(e) => set("whatsapp_app_secret", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-lang">Default template language</Label>
              <Input
                id="wa-lang"
                placeholder="en"
                value={form.whatsapp_default_language}
                onChange={(e) => set("whatsapp_default_language", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">Send notifications automatically</p>
              <p className="text-sm text-muted-foreground">
                Membership, serving-balance, renewal, check-in and celebration messages go out on their own.
              </p>
            </div>
            <Switch
              checked={form.whatsapp_automation_enabled === "true"}
              onCheckedChange={(v) => set("whatsapp_automation_enabled", v ? "true" : "false")}
            />
          </div>

          <div className="space-y-2">
            <Label>Webhook URL (paste into your provider panel)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("Webhook URL copied");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={save.isPending || isLoading}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test connection</CardTitle>
          <CardDescription>Sends one real message and shows the exact provider response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-test-phone">Mobile number</Label>
              <Input
                id="wa-test-phone"
                inputMode="numeric"
                placeholder="9876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-test-msg">Message</Label>
              <Input
                id="wa-test-msg"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => test.mutate({ phone: testPhone, message_content: testMessage })}
            disabled={test.isPending || testPhone.replace(/\D/g, "").length < 10}
          >
            {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send test message
          </Button>
          {test.data && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(test.data, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
