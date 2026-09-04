import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildSendRequest,
  corsHeaders,
  isWachat,
  json,
  loadWhatsAppConfig,
  parseSendResponse,
  serviceClient,
  toE164,
} from "../_shared/whatsapp.ts";
import { logApiCall } from "../_shared/whatsappService.ts";

interface Payload {
  phone?: string;
  template_name?: string | null;
  template_language?: string | null;
  template_variables?: string[] | null;
  message_content?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = serviceClient();

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isManager = (roles || []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "manager"
    );
    if (!isManager) return json({ error: "Forbidden: manager access required" }, 403);

    const body = (await req.json()) as Payload;
    const to = toE164(body.phone);
    if (!to) {
      return json({ success: false, error: "Enter a valid 10-digit mobile number" }, 400);
    }
    const templateName = body.template_name?.trim() || null;
    const freeText = body.message_content?.trim() || null;
    if (!templateName && !freeText) {
      return json({ success: false, error: "Pick a template or type a test message" }, 400);
    }

    const cfg = await loadWhatsAppConfig(supabase);
    const wachat = isWachat(cfg);
    const missing: string[] = [];
    if (!cfg.apiKey) missing.push("Access Token");
    if (wachat) {
      if (!cfg.vendorUid) missing.push("Vendor UID");
    } else if (!cfg.phoneNumberId) {
      missing.push("Phone Number ID");
    }
    if (missing.length) {
      return json({
        success: false,
        not_configured: true,
        error: `Missing credentials: ${missing.join(", ")}`,
      }, 200);
    }

    const vars = (body.template_variables || []).map((v) => String(v ?? ""));
    const { url, body: apiBody, headers } = buildSendRequest(cfg, {
      to,
      templateName,
      templateLanguage: body.template_language ?? null,
      vars,
      text: freeText,
    });

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(apiBody),
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Network error";
      await logApiCall(supabase, {
        action: "test_connection",
        functionName: "whatsapp-test-connection",
        phone: to,
        ok: false,
        error,
      });
      return json({ success: false, error }, 200);
    }

    const rawText = await res.text();
    let result: unknown = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { raw: rawText };
    }
    const outcome = parseSendResponse(cfg, res.ok, res.status, result);

    await logApiCall(supabase, {
      action: "test_connection",
      functionName: "whatsapp-test-connection",
      phone: to,
      ok: outcome.ok,
      httpStatus: res.status,
      providerCode: outcome.errorCode,
      providerMessageId: outcome.providerMessageId,
      error: outcome.error,
      summary: {
        provider: wachat ? "wachatsender" : "meta",
        latency_ms: Date.now() - started,
        response: rawText.slice(0, 500),
      },
    });

    return json({
      success: outcome.ok,
      provider: wachat ? "wachatsender" : "meta",
      http_status: res.status,
      provider_message_id: outcome.providerMessageId,
      error: outcome.error,
      details: outcome.errorDetails,
      raw: rawText.slice(0, 500),
    }, 200);
  } catch (e) {
    console.error("whatsapp-test-connection error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
