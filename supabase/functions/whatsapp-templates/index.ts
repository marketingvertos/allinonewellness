// Staff-only management of WhatsApp message templates on the connected Meta
// WhatsApp Business Account: list (all statuses), create (submit for approval)
// and delete. The access token never leaves the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, loadWhatsAppConfig, serviceClient } from "../_shared/whatsapp.ts";

interface MetaComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
}

interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  rejected_reason?: string;
  components?: MetaComponent[];
}

function componentText(t: MetaTemplate, type: string): string {
  return t.components?.find((c) => c.type?.toUpperCase() === type)?.text || "";
}

function variableCount(text: string): number {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  const numbers = matches.map((m) => Number(m.replace(/\D/g, "")));
  return numbers.length ? Math.max(...numbers) : 0;
}

function shape(t: MetaTemplate) {
  const body = componentText(t, "BODY");
  return {
    id: t.id ?? null,
    name: t.name,
    language: t.language,
    status: String(t.status || "").toUpperCase(),
    category: t.category ?? null,
    rejected_reason: t.rejected_reason ?? null,
    header: componentText(t, "HEADER"),
    body,
    footer: componentText(t, "FOOTER"),
    buttons: (t.components?.find((c) => c.type?.toUpperCase() === "BUTTONS")?.buttons ??
      []) as unknown[],
    variable_count: variableCount(body),
    has_media_header: Boolean(
      t.components?.some(
        (c) =>
          c.type?.toUpperCase() === "HEADER" &&
          ["IMAGE", "DOCUMENT", "VIDEO"].includes(String(c.format).toUpperCase()),
      ),
    ),
  };
}

function metaError(raw: string, status: number): string {
  try {
    const e = JSON.parse(raw)?.error;
    return [e?.error_user_msg, e?.message, e?.error_data?.details]
      .filter(Boolean).join(" · ") || `Meta returned ${status}`;
  } catch {
    return `Meta returned ${status}`;
  }
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
    const roleNames = (roles || []).map((r: { role: string }) => r.role);
    if (!roleNames.length) return json({ error: "Forbidden: staff access required" }, 403);

    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(payload?.action || "list");

    const cfg = await loadWhatsAppConfig(supabase);
    if (cfg.provider !== "meta") {
      return json({ success: false, error: "Templates are managed on Meta Cloud API only" }, 200);
    }
    if (!cfg.apiKey) {
      return json({ success: false, error: "WhatsApp access token is not configured" }, 200);
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
      }, 200);
    }

    const authHeaders = { Authorization: `Bearer ${cfg.apiKey}` };
    const base = `${cfg.apiUrl}/${wabaId}/message_templates`;

    // ---------------- create ----------------
    if (action === "create") {
      if (!roleNames.some((r) => ["admin", "manager"].includes(r))) {
        return json({ error: "Forbidden: manager access required" }, 403);
      }
      const name = String(payload.name || "").trim().toLowerCase()
        .replace(/[^a-z0-9_]/g, "_").slice(0, 512);
      const language = String(payload.language || "en").trim();
      const category = String(payload.category || "UTILITY").toUpperCase();
      const components = Array.isArray(payload.components) ? payload.components : [];
      if (!name) return json({ success: false, error: "Template name is required" }, 200);
      if (!components.length) {
        return json({ success: false, error: "The message body is required" }, 200);
      }

      const res = await fetch(base, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ name, language, category, components }),
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error(`whatsapp-templates create failed [${res.status}]`, raw.slice(0, 500));
        return json({ success: false, error: metaError(raw, res.status), http_status: res.status }, 200);
      }
      const created = JSON.parse(raw || "{}");
      return json({
        success: true,
        template: { id: created?.id ?? null, name, language, status: created?.status || "PENDING" },
      });
    }

    // ---------------- delete ----------------
    if (action === "delete") {
      if (!roleNames.some((r) => ["admin", "manager"].includes(r))) {
        return json({ error: "Forbidden: manager access required" }, 403);
      }
      const name = String(payload.name || "").trim();
      if (!name) return json({ success: false, error: "Template name is required" }, 200);
      const params = new URLSearchParams({ name });
      if (payload.template_id) params.set("hsm_id", String(payload.template_id));
      const res = await fetch(`${base}?${params.toString()}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error(`whatsapp-templates delete failed [${res.status}]`, raw.slice(0, 500));
        return json({ success: false, error: metaError(raw, res.status), http_status: res.status }, 200);
      }
      return json({ success: true });
    }

    // ---------------- list ----------------
    const approvedOnly = payload?.approved_only !== false;
    const url =
      `${base}?fields=id,name,language,status,category,components,rejected_reason&limit=200`;
    const res = await fetch(url, { headers: authHeaders });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`whatsapp-templates list failed [${res.status}]`, raw.slice(0, 400));
      return json({ success: false, error: metaError(raw, res.status), http_status: res.status }, 200);
    }

    const parsed = JSON.parse(raw || "{}");
    let templates = ((parsed?.data || []) as MetaTemplate[]).map(shape);
    if (approvedOnly) templates = templates.filter((t) => t.status === "APPROVED");
    templates.sort((a, b) => a.name.localeCompare(b.name));

    return json({ success: true, templates });
  } catch (e) {
    console.error("whatsapp-templates error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
