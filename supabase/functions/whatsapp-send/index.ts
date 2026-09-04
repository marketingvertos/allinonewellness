import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  isWachat,
  json,
  loadWhatsAppConfig,
  serviceClient,
  toE164,
} from "../_shared/whatsapp.ts";
import { sendWhatsApp } from "../_shared/whatsappService.ts";

interface Payload {
  member_id?: string | null;
  phone?: string | null;
  template_name?: string | null;
  template_language?: string | null;
  template_variables?: string[] | null;
  message_content?: string | null;
  source_module?: string | null;
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
    if (!(roles || []).length) {
      return json({ error: "Forbidden: staff access required" }, 403);
    }

    const body = (await req.json()) as Payload;
    const templateName = body.template_name?.trim() || null;
    const freeText = body.message_content?.trim() || null;
    if (!templateName && !freeText) {
      return json({ error: "Provide either template_name or message_content" }, 400);
    }

    let memberId = body.member_id?.trim() || null;
    let phone = body.phone || null;
    let displayName: string | null = null;

    if (memberId) {
      const { data: member } = await supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number")
        .eq("id", memberId)
        .maybeSingle();
      if (!member) return json({ error: "Member not found" }, 404);
      phone = member.mobile_number;
      displayName = member.full_name;
    } else if (phone) {
      const { data: member } = await supabase
        .from("wellness_members")
        .select("id, full_name")
        .ilike("mobile_number", `%${String(phone).replace(/\D/g, "").slice(-10)}%`)
        .limit(1);
      if (member?.[0]) {
        memberId = member[0].id;
        displayName = member[0].full_name;
      }
    }

    const to = toE164(phone);
    if (!to) return json({ error: "Invalid mobile number" }, 400);

    const cfg = await loadWhatsAppConfig(supabase);
    if (!cfg.apiKey || (isWachat(cfg) ? !cfg.vendorUid : !cfg.phoneNumberId)) {
      return json({
        error: "WhatsApp is not configured yet. Add the credentials in Settings → WhatsApp.",
        not_configured: true,
      }, 400);
    }

    const vars = (body.template_variables || []).map((v) => String(v ?? ""));

    const result = await sendWhatsApp(supabase, cfg, {
      to,
      templateName,
      templateLanguage: body.template_language ?? null,
      vars,
      text: freeText,
    }, {
      functionName: "whatsapp-send",
      sourceModule: (body.source_module as never) || "manual",
      memberId,
      sentBy: userId,
      displayName,
      logContent: freeText ||
        (vars.length ? `[${templateName}] ${vars.join(" | ")}` : `[${templateName}]`),
    });

    if (!result.ok) {
      return json({ success: false, error: result.error, id: result.messageId }, 200);
    }
    return json({
      success: true,
      id: result.messageId,
      provider_message_id: result.providerMessageId,
    });
  } catch (e) {
    console.error("whatsapp-send error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
