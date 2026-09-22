// Lists the approved WhatsApp message templates from the connected Meta
// WhatsApp Business Account. Staff only. The access token never leaves the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, loadWhatsAppConfig, serviceClient } from "../_shared/whatsapp.ts";

interface MetaComponent {
  type: string;
  format?: string;
  text?: string;
}

interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: MetaComponent[];
}

function bodyText(t: MetaTemplate): string {
  return t.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text || "";
}

function variableCount(text: string): number {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  const numbers = matches.map((m) => Number(m.replace(/\D/g, "")));
  return numbers.length ? Math.max(...numbers) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = serviceClient();
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (!(roles || []).length) return json({ error: "Forbidden: staff access required" }, 403);

    const cfg = await loadWhatsAppConfig(supabase);
    if (cfg.provider !== "meta") {
      return json({ success: false, error: "Templates are read from Meta Cloud API only" }, 400);
    }
    if (!cfg.apiKey) {
      return json({ success: false, error: "WhatsApp access token is not configured" }, 400);
    }

    const { data: wabaRow } = await supabase
      .from("integration_credentials")
      .select("value")
      .eq("key", "whatsapp_waba_id")
      .maybeSingle();
    const wabaId = (wabaRow?.value || Deno.env.get("META_WABA_ID") || "").trim();
    if (!wabaId) {
      return json({
        success: false,
        error:
          "WhatsApp Business Account ID is missing. Add it in Settings → WhatsApp Business API.",
      }, 400);
    }

    const url =
      `${cfg.apiUrl}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=200`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`whatsapp-templates failed [${res.status}]`, raw.slice(0, 400));
      let message = `Meta returned ${res.status}`;
      try {
        message = JSON.parse(raw)?.error?.message || message;
      } catch { /* keep default */ }
      return json({ success: false, error: message, http_status: res.status }, 200);
    }

    const parsed = JSON.parse(raw || "{}");
    const templates = ((parsed?.data || []) as MetaTemplate[])
      .filter((t) => String(t.status).toUpperCase() === "APPROVED")
      .map((t) => {
        const body = bodyText(t);
        return {
          name: t.name,
          language: t.language,
          category: t.category ?? null,
          body,
          variable_count: variableCount(body),
          has_media_header: Boolean(
            t.components?.some(
              (c) =>
                c.type?.toUpperCase() === "HEADER" &&
                ["IMAGE", "DOCUMENT", "VIDEO"].includes(String(c.format).toUpperCase()),
            ),
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return json({ success: true, templates });
  } catch (e) {
    console.error("whatsapp-templates error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
