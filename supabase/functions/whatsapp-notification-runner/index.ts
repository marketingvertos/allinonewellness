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

/** 2026-09-04 -> 04 Sep 2026 (IST) */
function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00+05:30` : value);
  if (isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

function fmtWeight(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : Number(value).toFixed(1);
}

/** signed change, e.g. "-7.1 kg" / "+1.4 kg" */
function fmtChange(latest: number | null, start: number | null): string {
  if (latest === null || start === null) return "";
  const diff = Number(latest) - Number(start);
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  return `${sign}${Math.abs(diff).toFixed(1)} kg`;
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
      .select("id, full_name, mobile_number, initial_weight, current_weight")
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

    // latest approved check-in weight per member (falls back to profile weight)
    const { data: checkinRows } = await supabase
      .from("wellness_checkin_requests")
      .select("member_id, requested_weight, decided_at")
      .in("member_id", memberIds)
      .eq("status", "approved")
      .not("requested_weight", "is", null)
      .order("decided_at", { ascending: false })
      .limit(200);
    const latestWeights = new Map<string, number>();
    for (const c of checkinRows || []) {
      if (!latestWeights.has(c.member_id) && c.requested_weight !== null) {
        latestWeights.set(c.member_id, Number(c.requested_weight));
      }
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
      const latestWeight = latestWeights.get(item.member_id) ??
        (member.current_weight !== null && member.current_weight !== undefined
          ? Number(member.current_weight)
          : null);
      const startWeight = member.initial_weight !== null &&
          member.initial_weight !== undefined
        ? Number(member.initial_weight)
        : null;
      const vars: Record<string, string> = {
        name: (member.full_name || "").split(" ")[0] || member.full_name || "",
        full_name: member.full_name || "",
        code: membership?.membership_code || "",
        end_date: fmtDate(membership?.end_date),
        remaining: String(membership?.remaining_servings ?? ""),
        servings: String(membership?.remaining_servings ?? ""),
        used_today: "1",
        weight: fmtWeight(latestWeight),
        start_weight: fmtWeight(startWeight),
        weight_change: fmtChange(latestWeight, startWeight),
        date: fmtDate(new Date().toISOString()),
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
