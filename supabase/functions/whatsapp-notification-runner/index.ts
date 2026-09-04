// Drains the wellness notification queue and sends each item on WhatsApp.
// Invoked on a schedule (pg_cron) and manually from the Notifications screen.

import {
  corsHeaders,
  validateConfig,
  json,
  loadWhatsAppConfig,
  serviceClient,
  toE164,
} from "../_shared/whatsapp.ts";
import { sendWhatsApp } from "../_shared/whatsappService.ts";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25;

interface TemplateRow {
  trigger_key: string;
  channel: string;
  active: boolean;
  message_template: string;
  template_name: string | null;
  template_language: string | null;
  variables: string[] | null;
}

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
}

/** serving_balance_3 falls back to the serving_balance template. */
function pickTemplate(
  templates: TemplateRow[],
  triggerKey: string,
): TemplateRow | null {
  const exact = templates.find((t) => t.trigger_key === triggerKey);
  if (exact) return exact;
  const generic = triggerKey.replace(/_\d+$/, "");
  return templates.find((t) => t.trigger_key === generic) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = serviceClient();

  try {
    const cfg = await loadWhatsAppConfig(supabase);
    if (!validateConfig(cfg).ok) {
      return json({ skipped: "not_configured", sent: 0, failed: 0 });
    }
    if (!cfg.automationEnabled) {
      return json({ skipped: "automation_disabled", sent: 0, failed: 0 });
    }

    const { data: queue, error: queueError } = await supabase
      .from("wellness_notification_log")
      .select("id, member_id, trigger_key, channel, message, attempts")
      .eq("status", "queued")
      .eq("channel", "whatsapp")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (queueError) throw queueError;
    if (!queue?.length) return json({ sent: 0, failed: 0, processed: 0 });

    const { data: templateRows } = await supabase
      .from("wellness_notification_templates")
      .select(
        "trigger_key, channel, active, message_template, template_name, template_language, variables",
      )
      .eq("channel", "whatsapp")
      .eq("active", true);
    const templates = (templateRows || []) as TemplateRow[];

    const memberIds = [...new Set(queue.map((q) => q.member_id))];
    const { data: memberRows } = await supabase
      .from("wellness_members")
      .select("id, full_name, mobile_number")
      .in("id", memberIds);
    const members = new Map(
      (memberRows || []).map((m) => [m.id, m]),
    );

    const { data: membershipRows } = await supabase
      .from("wellness_memberships")
      .select("member_id, membership_code, end_date, remaining_servings, status")
      .in("member_id", memberIds)
      .in("status", ["active", "expiring_soon"]);
    const memberships = new Map<string, typeof membershipRows[number]>();
    for (const m of membershipRows || []) {
      if (!memberships.has(m.member_id)) memberships.set(m.member_id, m);
    }

    let sent = 0;
    let failed = 0;

    for (const item of queue) {
      const member = members.get(item.member_id);
      const attempts = (item.attempts ?? 0) + 1;
      const markFailed = async (error: string) => {
        failed++;
        await supabase
          .from("wellness_notification_log")
          .update({
            status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
            error_message: error,
            attempts,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      };

      if (!member) {
        await markFailed("Member not found");
        continue;
      }
      const to = toE164(member.mobile_number);
      if (!to) {
        await markFailed("Invalid mobile number");
        continue;
      }

      const tpl = pickTemplate(templates, item.trigger_key);
      const membership = memberships.get(item.member_id);
      const vars: Record<string, string> = {
        name: (member.full_name || "").split(" ")[0] || member.full_name || "",
        full_name: member.full_name || "",
        code: membership?.membership_code || "",
        end_date: membership?.end_date || "",
        remaining: String(membership?.remaining_servings ?? ""),
        servings: String(membership?.remaining_servings ?? ""),
        date: new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      };

      const text = item.message?.trim() ||
        (tpl ? render(tpl.message_template, vars) : null);
      if (!text && !tpl?.template_name) {
        await markFailed(`No active template for "${item.trigger_key}"`);
        continue;
      }

      const templateVars = (tpl?.variables || []).map((v) => vars[v] ?? "");

      const result = await sendWhatsApp(supabase, cfg, {
        to,
        templateName: tpl?.template_name || null,
        templateLanguage: tpl?.template_language || null,
        vars: templateVars,
        text,
      }, {
        functionName: "whatsapp-notification-runner",
        sourceModule: "notification",
        memberId: member.id,
        displayName: member.full_name,
        logContent: text || `[${tpl?.template_name}]`,
      });

      if (result.ok) {
        sent++;
        await supabase
          .from("wellness_notification_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message: text,
            error_message: null,
            attempts,
            last_attempt_at: new Date().toISOString(),
            whatsapp_message_id: result.messageId,
          })
          .eq("id", item.id);
      } else {
        await markFailed(result.error || "WhatsApp send failed");
      }
    }

    return json({ processed: queue.length, sent, failed });
  } catch (e) {
    console.error("whatsapp-notification-runner error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
