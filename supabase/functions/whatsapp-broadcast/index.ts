import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  json,
  loadWhatsAppConfig,
  serviceClient,
  toE164,
  validateConfig,
} from "../_shared/whatsapp.ts";
import { sendWhatsApp } from "../_shared/whatsappService.ts";

type Mapping = { source: "first_name" | "full_name" | "fixed"; value?: string };

// deno-lint-ignore no-explicit-any
type Sb = any;

function resolveVars(mapping: Mapping[], fullName: string | null) {
  const name = (fullName || "").trim();
  return mapping.map((m) =>
    m.source === "full_name" ? name || "Member"
    : m.source === "first_name" ? (name.split(/\s+/)[0] || "Member")
    : String(m.value ?? "")
  );
}

async function refreshCounts(sb: Sb, id: string) {
  const { data } = await sb.from("whatsapp_broadcast_recipients").select("status").eq("broadcast_id", id);
  const rows = (data || []) as { status: string }[];
  const c = (s: string) => rows.filter((r) => r.status === s).length;
  const pending = c("pending");
  await sb.from("whatsapp_broadcasts").update({
    sent_count: c("sent"),
    failed_count: c("failed"),
    skipped_count: c("skipped"),
    status: pending ? "sending" : "completed",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return pending;
}

async function processBatch(sb: Sb, id: string, userId: string | null, size = 20) {
  const { data: b } = await sb.from("whatsapp_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!b) return 0;
  const { data: rows } = await sb.from("whatsapp_broadcast_recipients")
    .select("id, member_id, full_name, phone").eq("broadcast_id", id).eq("status", "pending").limit(size);
  if (!rows?.length) return await refreshCounts(sb, id);
  const cfg = await loadWhatsAppConfig(sb);
  for (const r of rows) {
    // claim the row so parallel runs don't double-send
    const { data: claimed } = await sb.from("whatsapp_broadcast_recipients")
      .update({ status: "sending" }).eq("id", r.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    const to = toE164(r.phone);
    if (!to) {
      await sb.from("whatsapp_broadcast_recipients").update({ status: "skipped", error: "Invalid mobile number" }).eq("id", r.id);
      continue;
    }
    const vars = resolveVars(b.variable_mapping || [], r.full_name);
    try {
      const res = await sendWhatsApp(sb, cfg, {
        to, templateName: b.template_name, templateLanguage: b.template_language, vars,
      }, {
        functionName: "whatsapp-broadcast",
        sourceModule: "manual",
        memberId: r.member_id,
        sentBy: userId,
        displayName: r.full_name,
        logContent: `[${b.template_name}] ${vars.join(" | ")}`,
      });
      await sb.from("whatsapp_broadcast_recipients").update({
        status: res.ok ? "sent" : "failed",
        error: res.ok ? null : res.error,
        whatsapp_message_id: res.messageId,
        sent_at: new Date().toISOString(),
      }).eq("id", r.id);
    } catch (e) {
      await sb.from("whatsapp_broadcast_recipients").update({
        status: "failed", error: e instanceof Error ? e.message : String(e),
      }).eq("id", r.id);
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  return await refreshCounts(sb, id);
}

async function runToEnd(sb: Sb, id: string, userId: string | null) {
  for (let i = 0; i < 200; i++) {
    const pending = await processBatch(sb, id, userId);
    if (!pending) break;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = serviceClient();
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await authClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
    if (!ok) return json({ error: "Only admin or manager can send broadcasts" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const cfg = await loadWhatsAppConfig(sb);
    const check = validateConfig(cfg);
    if (!check.ok && action !== "status") {
      return json({ success: false, error: `WhatsApp is not configured: ${check.problems.join(". ")}` });
    }

    if (action === "test") {
      const to = toE164(String(body.phone || ""));
      if (!to) return json({ success: false, error: "Enter a valid 10-digit mobile number" });
      const vars = resolveVars(body.variable_mapping || [], String(body.sample_name || "Test"));
      const res = await sendWhatsApp(sb, cfg, {
        to, templateName: body.template_name, templateLanguage: body.template_language, vars,
      }, { functionName: "whatsapp-broadcast", sourceModule: "manual", sentBy: userId, logContent: `[${body.template_name}] test` });
      return json({ success: res.ok, error: res.error });
    }

    if (action === "create") {
      const ids = (Array.isArray(body.member_ids) ? body.member_ids : []).map(String).slice(0, 5000);
      if (!ids.length) return json({ success: false, error: "No recipients selected" });
      if (!body.template_name) return json({ success: false, error: "Pick a template" });
      const members: { id: string; full_name: string; mobile_number: string }[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data } = await sb.from("wellness_members").select("id, full_name, mobile_number").in("id", ids.slice(i, i + 500));
        members.push(...(data || []));
      }
      const seen = new Set<string>();
      const rows = members.map((m) => {
        const d = String(m.mobile_number || "").replace(/\D/g, "").slice(-10);
        const dup = d.length === 10 && seen.has(d);
        if (d.length === 10) seen.add(d);
        const bad = d.length !== 10;
        return {
          member_id: m.id, full_name: m.full_name, phone: m.mobile_number,
          status: bad || dup ? "skipped" : "pending",
          error: bad ? "Missing or invalid mobile number" : dup ? "Duplicate number" : null,
        };
      });
      const { data: b, error } = await sb.from("whatsapp_broadcasts").insert({
        template_name: body.template_name,
        template_language: body.template_language || "en_US",
        variable_mapping: body.variable_mapping || [],
        filters: body.filters || {},
        total_count: rows.length,
        created_by: userId,
      }).select("id").single();
      if (error) throw error;
      for (let i = 0; i < rows.length; i += 500) {
        await sb.from("whatsapp_broadcast_recipients").insert(rows.slice(i, i + 500).map((r) => ({ ...r, broadcast_id: b.id })));
      }
      await refreshCounts(sb, b.id);
      // @ts-ignore EdgeRuntime is available in the Supabase runtime
      EdgeRuntime.waitUntil(runToEnd(sb, b.id, userId));
      return json({ success: true, id: b.id });
    }

    if (action === "process" || action === "retry_failed") {
      const id = String(body.id || "");
      if (action === "retry_failed") {
        await sb.from("whatsapp_broadcast_recipients").update({ status: "pending", error: null })
          .eq("broadcast_id", id).eq("status", "failed");
      }
      // Reset rows stuck mid-send for over 2 minutes
      await refreshCounts(sb, id);
      // @ts-ignore EdgeRuntime
      EdgeRuntime.waitUntil(runToEnd(sb, id, userId));
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("whatsapp-broadcast", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
