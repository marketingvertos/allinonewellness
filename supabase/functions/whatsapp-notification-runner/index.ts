// Drains the wellness notification queue and sends each item on WhatsApp.
// Invoked on a schedule (pg_cron) and manually from the Notifications screen.

import {
  ACCOUNT_BLOCKED_MESSAGE,
  corsHeaders,
  validateConfig,
  json,
  loadWhatsAppConfig,
  serviceClient,
  toE164,
} from "../_shared/whatsapp.ts";
import { sendWhatsApp } from "../_shared/whatsappService.ts";
import { buildYellowCard } from "./yellowCard.ts";

// deno-lint-ignore no-explicit-any
async function syncTemplateStatuses(supabase: any, cfg: any): Promise<Map<string, string>> {
  const status = new Map<string, string>();
  try {
    if (cfg.provider !== "meta" || !cfg.apiKey) return status;
    const { data: wabaRow } = await supabase.from("integration_credentials")
      .select("value").eq("key", "whatsapp_waba_id").maybeSingle();
    const wabaId = (wabaRow?.value || Deno.env.get("META_WABA_ID") || "").trim();
    if (!wabaId) return status;
    const res = await fetch(`${cfg.apiUrl}/${wabaId}/message_templates?fields=name,status&limit=500`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) return status;
    const body = await res.json();
    for (const t of body?.data || []) {
      const cur = status.get(t.name);
      if (cur !== "APPROVED") status.set(t.name, String(t.status).toUpperCase());
    }
    const { data: rows } = await supabase.from("wellness_notification_templates")
      .select("id, template_name, next_template_name, next_variables, next_status")
      .eq("channel", "whatsapp");
    for (const r of rows || []) {
      if (r.next_template_name) {
        const st = status.get(r.next_template_name) || "PENDING";
        if (st === "APPROVED") {
          await supabase.from("wellness_notification_templates").update({
            template_name: r.next_template_name,
            variables: r.next_variables || [],
            next_template_name: null,
            next_variables: null,
            next_status: "APPROVED",
          }).eq("id", r.id);
          status.set(r.next_template_name, "APPROVED");
        } else if (st !== r.next_status) {
          await supabase.from("wellness_notification_templates").update({ next_status: st }).eq("id", r.id);
        }
      } else if (r.template_name) {
        const st = status.get(r.template_name) || "UNKNOWN";
        if (st !== r.next_status) {
          await supabase.from("wellness_notification_templates").update({ next_status: st }).eq("id", r.id);
        }
      }
    }
  } catch (e) {
    console.error("template status sync failed", e);
  }
  return status;
}


const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25;
const EVENING_BATCH_SIZE = 100;

/** Renewal/reactivation reminders only go out from 8:30 pm IST. */
function isEveningTrigger(key: string): boolean {
  return key.startsWith("serving_balance") || key === "renewal_reminder" ||
    key === "membership_expired" || key.startsWith("membership_reactivation");
}
function inEveningWindow(): boolean {
  const ist = new Date(Date.now() + 330 * 60000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 20 * 60 + 30 && mins < 21 * 60;
}

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

    // Sync Meta approval status; promote approved replacement templates.
    const metaStatus = await syncTemplateStatuses(supabase, cfg);

    const evening = inEveningWindow();
    const { data: rawQueue, error: queueError } = await supabase
      .from("wellness_notification_log")
      .select("id, member_id, trigger_key, channel, message, attempts, payload, created_at")
      .eq("status", "queued")
      .eq("channel", "whatsapp")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(500);
    if (queueError) throw queueError;

    const { data: templateRows } = await supabase
      .from("wellness_notification_templates")
      .select(
        "trigger_key, channel, active, message_template, template_name, template_language, variables",
      )
      .eq("channel", "whatsapp")
      .eq("active", true);
    const templates = (templateRows || []) as TemplateRow[];

    // Hold messages whose template Meta hasn't approved; drop them after 24 hours.
    const ready: typeof rawQueue = [];
    for (const q of rawQueue || []) {
      const t = pickTemplate(templates, q.trigger_key);
      const st = t?.template_name && !q.message ? metaStatus.get(t.template_name) : "APPROVED";
      if (!metaStatus.size || st === "APPROVED") { ready.push(q); continue; }
      if (Date.now() - new Date(q.created_at).getTime() > 86400000) {
        await supabase.from("wellness_notification_log").update({
          status: "skipped",
          error_message: `Template "${t?.template_name}" was not approved within 24 hours`,
        }).eq("id", q.id);
      }
    }
    const queue = ready
      .filter((q) => evening || !isEveningTrigger(q.trigger_key))
      .slice(0, evening ? EVENING_BATCH_SIZE : BATCH_SIZE);
    if (!queue.length) return json({ sent: 0, failed: 0, processed: 0 });

    const memberIds = [...new Set(queue.map((q) => q.member_id))];
    const { data: memberRows } = await supabase
      .from("wellness_members")
      .select(
        "id, full_name, mobile_number, initial_weight, current_weight, joining_date, activation_code, referred_by_member_id",
      )
      .in("id", memberIds);
    const members = new Map(
      (memberRows || []).map((m) => [m.id, m]),
    );
    const coachIds = [...new Set((memberRows || []).map((m) => m.referred_by_member_id).filter(Boolean))];
    const coaches = new Map<string, string>();
    if (coachIds.length) {
      const { data: coachRows } = await supabase
        .from("wellness_members").select("id, full_name").in("id", coachIds as string[]);
      for (const c of coachRows || []) coaches.set(c.id, c.full_name);
    }

    const { data: membershipRows } = await supabase
      .from("wellness_memberships")
      .select(
        "member_id, id, start_date, membership_code, end_date, remaining_servings, total_servings, used_servings, price_paid, servings_exhausted_on, status, wellness_plans(name)",
      )
      .in("member_id", memberIds)
      .in("status", ["active", "expiring_soon"]);
    const memberships = new Map<string, typeof membershipRows[number]>();
    for (const m of membershipRows || []) {
      if (!memberships.has(m.member_id)) memberships.set(m.member_id, m);
    }

    // latest expired membership, for reactivation reminders
    const expiredInfo = new Map<string, { plan: string; on: string }>();
    const reactivationIds = queue
      .filter((q) => q.trigger_key.startsWith("membership_reactivation"))
      .map((q) => q.member_id);
    if (reactivationIds.length) {
      const { data: expRows } = await supabase
        .from("wellness_memberships")
        .select("member_id, end_date, servings_exhausted_on, wellness_plans(name)")
        .in("member_id", reactivationIds)
        .eq("status", "expired")
        .order("end_date", { ascending: false });
      for (const e of expRows || []) {
        if (expiredInfo.has(e.member_id)) continue;
        const addDays = (d: string, n: number) =>
          new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
        let on = addDays(e.end_date, 1);
        if (e.servings_exhausted_on) {
          const s = addDays(e.servings_exhausted_on, 11);
          if (s < on) on = s;
        }
        // deno-lint-ignore no-explicit-any
        expiredInfo.set(e.member_id, { plan: (e as any).wellness_plans?.name || "", on: fmtDate(on) });
      }
    }

    // active trials
    const { data: trialRows } = await supabase
      .from("wellness_trials")
      .select("member_id, end_date, status, wellness_plans(name)")
      .in("member_id", memberIds)
      .eq("status", "active");
    const trials = new Map<string, { end_date: string | null; wellness_plans?: { name?: string } | null }>();
    for (const t of trialRows || []) {
      if (!trials.has(t.member_id)) trials.set(t.member_id, t);
    }

    // most recent unlocked milestone
    const { data: achievementRows } = await supabase
      .from("member_achievements")
      .select("member_id, unlocked_at, achievement_definitions(name)")
      .in("member_id", memberIds)
      .order("unlocked_at", { ascending: false })
      .limit(200);
    const milestones = new Map<string, string>();
    for (const a of achievementRows || []) {
      const name = (a as { achievement_definitions?: { name?: string } })
        .achievement_definitions?.name;
      if (name && !milestones.has(a.member_id)) milestones.set(a.member_id, name);
    }

    // most recent payment
    const { data: paymentRows } = await supabase
      .from("wellness_payments")
      .select("member_id, amount, mode, paid_at")
      .in("member_id", memberIds)
      .order("paid_at", { ascending: false })
      .limit(200);
    const payments = new Map<string, { amount: number; mode: string }>();
    for (const p of paymentRows || []) {
      if (!payments.has(p.member_id)) {
        payments.set(p.member_id, { amount: Number(p.amount), mode: String(p.mode) });
      }
    }

    // most recent packed-and-issued servings
    const { data: issuedRows } = await supabase
      .from("serving_transactions")
      .select("member_id, change, note, created_at, attendance_id")
      .in("member_id", memberIds)
      .eq("txn_type", "pack_and_issue")
      .order("created_at", { ascending: false })
      .limit(200);
    const issued = new Map<string, { qty: number; note: string }>();
    for (const s of issuedRows || []) {
      if (!issued.has(s.member_id)) {
        issued.set(s.member_id, { qty: Math.abs(Number(s.change)), note: s.note || "" });
      }
    }

    // two most recent weight readings per member
    const { data: weightHistory } = await supabase
      .from("weight_tracking")
      .select("member_id, weight, recorded_date, created_at")
      .in("member_id", memberIds)
      .order("recorded_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(400);
    const weightPairs = new Map<string, number[]>();
    for (const w of weightHistory || []) {
      if (w.weight === null) continue;
      const list = weightPairs.get(w.member_id) ?? [];
      if (list.length < 2) {
        list.push(Number(w.weight));
        weightPairs.set(w.member_id, list);
      }
    }

    // today's recorded weight per member (IST), then the latest approved check-in weight
    const istToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
      .format(new Date());
    const { data: todayWeightRows } = await supabase
      .from("weight_tracking")
      .select("member_id, weight, created_at")
      .in("member_id", memberIds)
      .eq("recorded_date", istToday)
      .order("created_at", { ascending: false });
    const latestWeights = new Map<string, number>();
    for (const w of todayWeightRows || []) {
      if (!latestWeights.has(w.member_id) && w.weight !== null) {
        latestWeights.set(w.member_id, Number(w.weight));
      }
    }

    const { data: checkinRows } = await supabase
      .from("wellness_checkin_requests")
      .select("member_id, requested_weight, decided_at")
      .in("member_id", memberIds)
      .eq("status", "approved")
      .not("requested_weight", "is", null)
      .order("decided_at", { ascending: false })
      .limit(200);
    for (const c of checkinRows || []) {
      if (!latestWeights.has(c.member_id) && c.requested_weight !== null) {
        latestWeights.set(c.member_id, Number(c.requested_weight));
      }
    }


    let sent = 0;
    let failed = 0;
    let blocked = false;

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
      const pair = weightPairs.get(item.member_id) ?? [];
      const trial = trials.get(item.member_id);
      const payment = payments.get(item.member_id);
      const issuedPack = issued.get(item.member_id);
      const planName =
        (membership as { wellness_plans?: { name?: string } } | undefined)?.wellness_plans?.name ||
        "";
      const exhausted = membership?.servings_exhausted_on
        ? Math.max(
          0,
          10 - Math.floor(
            (Date.now() - new Date(`${membership.servings_exhausted_on}T00:00:00+05:30`).getTime()) /
              86400000,
          ),
        )
        : null;
      const trialDaysLeft = trial?.end_date
        ? Math.max(
          0,
          Math.ceil(
            (new Date(`${trial.end_date}T00:00:00+05:30`).getTime() - Date.now()) / 86400000,
          ),
        )
        : null;
      const vars: Record<string, string> = {
        name: (member.full_name || "").split(" ")[0] || member.full_name || "",
        full_name: member.full_name || "",
        mobile: member.mobile_number || "",
        activation_code: member.activation_code || "",
        joining_date: fmtDate(member.joining_date),
        code: membership?.membership_code || "",
        plan_name: planName,
        total_servings: String(membership?.total_servings ?? ""),
        used_servings: String(membership?.used_servings ?? ""),
        price: payment
          ? new Intl.NumberFormat("en-IN").format(payment.amount)
          : membership?.price_paid !== undefined && membership?.price_paid !== null
          ? new Intl.NumberFormat("en-IN").format(Number(membership.price_paid))
          : "",
        payment_mode: payment?.mode || "",
        end_date: fmtDate(membership?.end_date),
        remaining: String(membership?.remaining_servings ?? ""),
        servings: String(membership?.remaining_servings ?? ""),
        renewal_days_left: exhausted === null ? "" : String(exhausted),
        trial_end_date: fmtDate(trial?.end_date),
        trial_days_left: trialDaysLeft === null ? "" : String(trialDaysLeft),
        milestone: milestones.get(item.member_id) || "",
        issued_servings: issuedPack ? String(issuedPack.qty) : "",
        issue_reason: issuedPack?.note || "",
        used_today: "1",
        weight: fmtWeight(latestWeight),
        last_weight: pair.length > 1 ? fmtWeight(pair[1]) : "",
        daily_change: pair.length > 1 ? fmtChange(pair[0], pair[1]) : "N/A",
        start_weight: fmtWeight(startWeight),
        weight_change: fmtChange(latestWeight, startWeight),
        date: fmtDate(new Date().toISOString()),
        renewal_window_days: "10",
        last_plan_name: expiredInfo.get(item.member_id)?.plan || planName,
        expired_on: expiredInfo.get(item.member_id)?.on || "",
        trial_plan_name: trial?.wellness_plans?.name || "Trial",
        coach_name: (member.referred_by_member_id && coaches.get(member.referred_by_member_id)) || "Shri Chatap",
        covered_dates: issuedPack?.note || fmtDate(new Date().toISOString()),
        weight_change_abs: latestWeight !== null && startWeight !== null
          ? Math.abs(latestWeight - startWeight).toFixed(1) : "",
        start_date: fmtDate((membership as { start_date?: string } | undefined)?.start_date),
        wlp_remaining: String(membership?.remaining_servings ?? ""),
      };
      for (const [k, v] of Object.entries((item.payload || {}) as Record<string, unknown>)) {
        if (v !== null && v !== undefined && String(v).trim()) vars[k] = String(v);
      }


      const text = item.message?.trim() ||
        (tpl ? render(tpl.message_template, vars) : null);
      if (!text && !tpl?.template_name) {
        await markFailed(`No active template for "${item.trigger_key}"`);
        continue;
      }

      // Meta rejects empty template parameters — never send a blank value.
      const templateVars = (tpl?.variables || []).map((v) => {
        const value = (vars[v] ?? "").trim();
        if (value) return value;
        return v === "daily_change" || v === "weight_change" ? "N/A" : "—";
      });

      let mediaUrl: string | null = null;
      if (item.trigger_key === "yellow_card") {
        try {
          const pdf = buildYellowCard({
            name: member.full_name || "", mobile: member.mobile_number || "",
            plan: vars.plan_name, code: vars.code, startDate: vars.start_date,
            totalServings: vars.total_servings, remaining: vars.remaining,
            price: vars.price, paymentMode: vars.payment_mode,
          });
          const path = `yellow-cards/${member.id}/${Date.now()}.pdf`;
          const up = await supabase.storage.from("promotion-media")
            .upload(path, pdf, { contentType: "application/pdf", upsert: true });
          if (up.error) throw up.error;
          const signed = await supabase.storage.from("promotion-media").createSignedUrl(path, 60 * 60 * 24 * 7);
          mediaUrl = signed.data?.signedUrl || null;
        } catch (e) {
          await markFailed(`Could not create Yellow Card: ${e instanceof Error ? e.message : e}`);
          continue;
        }
      }

      const result = await sendWhatsApp(supabase, cfg, {
        to,
        ...(mediaUrl ? { mediaUrl, mediaType: "document" as const, mediaFileName: "Yellow-Card.pdf" } : {}),
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
        if (item.trigger_key === "membership_activated" || item.trigger_key === "membership_renewed") {
          await supabase.rpc("queue_member_notification_payload", {
            p_member_id: member.id, p_trigger: "yellow_card", p_dedupe: "1 hour", p_payload: {},
          });
        }
      } else if (result.accountBlocked) {
        // Account-level block at Meta: nothing in the queue can go out. Keep the
        // item queued without burning an attempt and stop the batch.
        blocked = true;
        await supabase
          .from("wellness_notification_log")
          .update({
            status: "queued",
            error_message: ACCOUNT_BLOCKED_MESSAGE,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        break;
      } else if (
        tpl?.template_name &&
        /132001|does not exist|not approved|pending/i.test(result.error || "")
      ) {
        // Template still under Meta review: keep queued without burning an attempt.
        await supabase
          .from("wellness_notification_log")
          .update({
            status: "queued",
            error_message: `Waiting for Meta approval of "${tpl.template_name}"`,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        await markFailed(result.error || "WhatsApp send failed");
      }
    }

    return json({
      processed: queue.length,
      sent,
      failed,
      ...(blocked ? { blocked: true, reason: ACCOUNT_BLOCKED_MESSAGE } : {}),
    });
  } catch (e) {
    console.error("whatsapp-notification-runner error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
