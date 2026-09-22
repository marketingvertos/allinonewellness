import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, CheckCircle2, AlertTriangle } from "lucide-react";

interface SendResult {
  success: boolean;
  message_id?: string | null;
  http_status?: number | null;
  error?: { message?: string; code?: string | number | null; details?: string | null } | null;
}

export default function WhatsAppTest() {
  const [phone, setPhone] = useState("919815064617");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const send = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-cloud-send", {
        body: { to: phone.replace(/[^\d]/g, ""), template_name: "hello_world", language: "en_US" },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.text();
          try {
            setResult(JSON.parse(body) as SendResult);
          } catch {
            setResult({ success: false, error: { message: body } });
          }
        } else {
          setResult({ success: false, error: { message: error.message } });
        }
        return;
      }
      setResult(data as SendResult);
    } catch (e) {
      setResult({
        success: false,
        error: { message: e instanceof Error ? e.message : "Unexpected error" },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp API Test</h1>
        <p className="text-sm text-muted-foreground">
          Sends one real template message through the WhatsApp Cloud API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test message</CardTitle>
          <CardDescription>
            Message type: Template &middot; Template: hello_world &middot; Language: en_US
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-phone">Phone number (with country code, no +)</Label>
            <Input
              id="wa-phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="919815064617"
            />
          </div>

          <Button onClick={send} disabled={loading || !phone.trim()} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {loading ? "Sending…" : "Send Test WhatsApp Message"}
          </Button>

          {result?.success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>WhatsApp message sent successfully.</AlertTitle>
              <AlertDescription>
                <div className="mt-1 text-xs">Message ID</div>
                <code className="block break-all text-xs">{result.message_id}</code>
              </AlertDescription>
            </Alert>
          )}

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>WhatsApp message failed.</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                {result.http_status ? <div>HTTP status: {result.http_status}</div> : null}
                <div>Message: {result.error?.message || "Unknown error"}</div>
                {result.error?.code != null && <div>Code: {String(result.error.code)}</div>}
                {result.error?.details && (
                  <div className="break-all">Details: {result.error.details}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
