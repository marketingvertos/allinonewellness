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
import { sendWhatsApp } from "../_shared/whatsappService.ts";

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
      error: result.error,
      details: result.errorDetails,
    }, 200);
  } catch (e) {
    console.error("whatsapp-test-connection error", e);
    return json({
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error",
    }, 200);
  }
});
