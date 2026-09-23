import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  isWachat,
  json,
  loadWhatsAppConfig,
  serviceClient,
  toE164,
  validateConfig,
} from "../_shared/whatsapp.ts";
import { redactSecrets, sendWhatsApp } from "../_shared/whatsappService.ts";

interface Payload {
  /** "status" asks Meta about the account instead of sending a test message. */
  action?: string;
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

    if (body.action === "status") {
      const cfg = await loadWhatsAppConfig(supabase);
      if (isWachat(cfg)) {
        return json({
          success: false,
          error: "Account status is only available for the Meta Cloud API",
        }, 200);
      }
      if (!cfg.apiKey || !cfg.phoneNumberId) {
        return json({ success: false, error: "WhatsApp is not configured yet" }, 200);
      }
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("value")
        .eq("key", "whatsapp_waba_id")
        .maybeSingle();
      const wabaId = String(cred?.value || "").trim();

      const ask = async (path: string, fields: string) => {
        const res = await fetch(`${cfg.apiUrl}/${path}?fields=${fields}`, {
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
        });
        const payload = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, payload };
      };

      const number = await ask(
        cfg.phoneNumberId,
        "display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status,code_verification_status,platform_type,throughput",
      );
      const account = wabaId
        ? await ask(
          wabaId,
          "name,account_review_status,business_verification_status,country,currency,timezone_id",
        )
        : null;

      const firstError = !number.ok
        ? number.payload?.error
        : account && !account.ok
        ? account.payload?.error
        : null;

      return json({
        success: number.ok && (!account || account.ok),
        api_url: cfg.apiUrl,
        number: number.ok ? number.payload : null,
        account: account?.ok ? account.payload : null,
        error: firstError
          ? redactSecrets(`${firstError.message}${firstError.code ? ` · code ${firstError.code}` : ""}`)
          : null,
        blocked: /api access blocked/i.test(String(firstError?.message || "")),
      }, 200);
    }

    const to = toE164(body.phone);
    if (!to) {
      return json({ success: false, error: "Enter a valid 10-digit mobile number" }, 200);
    }
    const templateName = body.template_name?.trim() || null;
    const freeText = body.message_content?.trim() || null;
    if (!templateName && !freeText) {
      return json({ success: false, error: "Pick a template or type a test message" }, 200);
    }

    const cfg = await loadWhatsAppConfig(supabase);
    const provider = isWachat(cfg) ? "wachatsender" : "meta";
    const check = validateConfig(cfg);
    if (!check.ok) {
      return json({
        success: false,
        not_configured: true,
        provider,
        api_url: cfg.apiUrl,
        error: check.problems.join(". "),
      }, 200);
    }

    const started = Date.now();
    const result = await sendWhatsApp(
      supabase,
      cfg,
      {
        to,
        templateName,
        templateLanguage: body.template_language ?? null,
        vars: (body.template_variables || []).map((v) => String(v ?? "")),
        text: freeText,
      },
      {
        functionName: "whatsapp-test-connection",
        sourceModule: "diagnostics",
        sentBy: userId,
        logContent: freeText ?? `[${templateName}]`,
      },
    );

    return json({
      success: result.ok,
      provider,
      api_url: cfg.apiUrl,
      http_status: result.httpStatus,
      message_id: result.messageId,
      conversation_id: result.conversationId,
      provider_message_id: result.providerMessageId,
      latency_ms: Date.now() - started,
      error: redactSecrets(result.error),
      details: redactSecrets(result.errorDetails),
    }, 200);
  } catch (e) {
    console.error("whatsapp-test-connection error", e);
    return json({
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error",
    }, 200);
  }
});
