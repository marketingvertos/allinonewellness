// Mirrors the CRM into a Google Sheet (11 tabs). Called every 15 min by pg_cron
// (x-cron-secret header) or by admins from Settings → Backup.
// Actions: "sync" (default), "status", "export" (returns the tab data as JSON).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const TZ = "Asia/Kolkata";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
type Row = Record<string, any>;

async function all(sb: any, table: string, select: string, order = "created_at"): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).order(order, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const dt = (v: string | null) => (v ? new Date(v).toLocaleString("en-IN", { timeZone: TZ, hour12: true }) : "");
const d = (v: string | null) => v ?? "";
const n = (v: any) => (v === null || v === undefined ? "" : Number(v));

async function getCred(sb: any, key: string) {
  const { data } = await sb.from("integration_credentials").select("value").eq("key", key).maybeSingle();
  return (data?.value as string | null) ?? null;
}
async function setCred(sb: any, key: string, value: string) {
  await sb.from("integration_credentials").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function buildTabs(sb: any): Promise<Record<string, (string | number)[][]>> {
  const [members, batches, cats, plans, memberships, attendance, payments, txns, trials, weights, bodies, achDefs, achs, pink, profiles] =
    await Promise.all([
      all(sb, "wellness_members", "*"),
      all(sb, "wellness_batches", "id,name"),
      all(sb, "member_categories", "id,name"),
      all(sb, "wellness_plans", "id,name,price"),
      all(sb, "wellness_memberships", "*"),
      all(sb, "wellness_attendance", "*", "visit_time"),
      all(sb, "wellness_payments", "*", "paid_at"),
      all(sb, "serving_transactions", "*"),
      all(sb, "wellness_trials", "*"),
      all(sb, "weight_tracking", "*", "recorded_date"),
      all(sb, "body_measurements", "*", "recorded_date"),
      all(sb, "achievement_definitions", "id,name,category,threshold,unit"),
      all(sb, "member_achievements", "*", "unlocked_at"),
      all(sb, "pink_card_ledger", "*"),
      all(sb, "profiles", "user_id,full_name"),
    ]);
  const map = (rows: Row[], k = "id") => new Map(rows.map((r) => [r[k], r]));
  const M = map(members), B = map(batches), C = map(cats), P = map(plans), MS = map(memberships), A = map(achDefs);
  const staff = new Map(profiles.map((p) => [p.user_id, p.full_name ?? ""]));
  const name = (id: string | null) => (id ? M.get(id)?.full_name ?? "" : "");
  const mob = (id: string | null) => (id ? M.get(id)?.mobile_number ?? "" : "");
  const today = todayIst();
  const month = today.slice(5, 7);

  const age = (dob: string | null) => {
    if (!dob) return "";
    const [y, m, dd] = dob.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    let a = ty - y; if (tm < m || (tm === m && td < dd)) a--; return a;
  };
  const daysLeft = (end: string) => Math.max(0, Math.round((Date.parse(end) - Date.parse(today)) / 86400000));

  const tabs: Record<string, (string | number)[][]> = {};
  tabs["Members Master"] = [
    ["Member ID","Full Name","Mobile","Email","Gender","Date of Birth","Age","Birthday This Month","Member Mode","Status","Joining Date","Current Weight","Initial Weight","Weight Change","Goal","Height","Referred By","Frontline Referrals","Total Network","Master Level","Pink Card Balance","Batch","Category","Tags","Marital Status","Anniversary","Has Login"],
    ...members.map((m) => [m.id, m.full_name, m.mobile_number, d(m.email), d(m.gender), d(m.date_of_birth), age(m.date_of_birth),
      m.date_of_birth?.slice(5, 7) === month ? "YES" : "", m.member_mode, m.status, m.joining_date, n(m.current_weight), n(m.initial_weight),
      m.current_weight != null && m.initial_weight != null ? Number((m.current_weight - m.initial_weight).toFixed(1)) : "",
      d(m.goal), n(m.height), name(m.referred_by_member_id), m.frontline_count, m.network_total, m.master_level, m.pink_card_balance,
      B.get(m.batch_id)?.name ?? "", C.get(m.category_id)?.name ?? "", (m.tags ?? []).join(", "), d(m.marital_status), d(m.anniversary_date), m.user_id ? "YES" : "NO"]),
  ];
  tabs["Active Memberships"] = [
    ["Membership ID","Code","Member","Mobile","Plan","Status","Start","End","Days Left","Total Servings","Used","Remaining","Price Paid","Payment Mode","Payment Date","Renewal"],
    ...memberships.filter((x) => ["active","expiring_soon","queued"].includes(x.status)).map((x) => [x.id, x.membership_code, name(x.member_id), mob(x.member_id),
      P.get(x.plan_id)?.name ?? "", x.status, x.start_date, x.end_date, daysLeft(x.end_date), x.total_servings, x.used_servings, x.remaining_servings,
      n(x.price_paid), x.payment_mode, d(x.payment_date), x.renewed_from ? "Renewal" : "New"]),
  ];
  tabs["Attendance Log"] = [
    ["Date","Time (IST)","Member","Mobile","Mode","Method","Serving Deducted","Balance After","Plan","Staff"],
    ...attendance.map((a) => [a.visit_date, dt(a.visit_time), name(a.member_id), mob(a.member_id), M.get(a.member_id)?.member_mode ?? "",
      a.checkin_method, a.serving_deducted ? "YES" : "NO", n(a.remaining_balance_snapshot), P.get(MS.get(a.membership_id)?.plan_id)?.name ?? "", staff.get(a.staff_id) ?? ""]),
  ];
  tabs["Payments"] = [
    ["Paid At (IST)","Member","Mobile","Plan","Amount (INR)","Mode","Reference","Context","Note","Recorded By"],
    ...payments.map((p) => [dt(p.paid_at), name(p.member_id), mob(p.member_id), P.get(MS.get(p.membership_id)?.plan_id)?.name ?? "", n(p.amount), p.mode, d(p.reference), p.context, d(p.note), staff.get(p.recorded_by) ?? ""]),
  ];
  tabs["Serving Transactions"] = [
    ["When (IST)","Member","Type","Change","Balance After","Plan","Note","By"],
    ...txns.map((t) => [dt(t.created_at), name(t.member_id), t.txn_type, t.change, t.balance_after, P.get(MS.get(t.membership_id)?.plan_id)?.name ?? "", d(t.note), staff.get(t.created_by) ?? ""]),
  ];
  tabs["Trials"] = [
    ["Member","Mobile","Plan","Start","Days","End","Weight at Start","Status","Created (IST)"],
    ...trials.map((t) => [name(t.member_id), mob(t.member_id), P.get(t.plan_id)?.name ?? "", t.start_date, t.duration_days, d(t.end_date), n(t.weight_at_start), t.status, dt(t.created_at)]),
  ];
  tabs["Weight Tracking"] = [
    ["Date","Member","Mobile","Weight (kg)","Notes"],
    ...weights.map((w) => [w.recorded_date, name(w.member_id), mob(w.member_id), n(w.weight), d(w.notes)]),
  ];
  tabs["Body Measurements"] = [
    ["Date","Member","Weight","Body Fat %","Trunk Fat","Muscle Mass","Visceral Fat","BMR","BMI","Body Age","Ideal Weight","Waist","Hip","Chest","Remark"],
    ...bodies.map((b) => [b.recorded_date, name(b.member_id), n(b.weight), n(b.body_fat_percentage), n(b.trunk_fat), n(b.muscle_mass), n(b.visceral_fat), n(b.bmr), n(b.bmi), n(b.body_age), n(b.ideal_weight), n(b.waist), n(b.hip), n(b.chest), d(b.remark)]),
  ];
  tabs["Achievements"] = [
    ["Unlocked (IST)","Member","Achievement","Category","Threshold"],
    ...achs.map((a) => { const def = A.get(a.achievement_id); return [dt(a.unlocked_at), name(a.member_id), def?.name ?? "", def?.category ?? "", def ? `${def.threshold} ${def.unit}` : ""]; }),
  ];
  tabs["Pink Card Ledger"] = [
    ["When (IST)","Member","Change","Balance After","Reason","Referred Member","Note"],
    ...pink.map((p) => [dt(p.created_at), name(p.member_id), p.change, p.balance_after, p.reason, name(p.referred_member_id), d(p.note)]),
  ];
  // Daily summary: last 60 days
  const days: string[] = [];
  for (let i = 0; i < 60; i++) days.push(new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10));
  const istDate = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });
  tabs["Daily Summary"] = [
    ["Date","Check-ins","Servings Packed","New Memberships","Renewals","Revenue (INR)","New Members"],
    ...days.map((day) => [day,
      attendance.filter((a) => a.visit_date === day && a.checkin_method !== "serving_issue").length,
      attendance.filter((a) => a.visit_date === day && a.checkin_method === "serving_issue").length,
      memberships.filter((x) => istDate(x.created_at) === day && !x.renewed_from).length,
      memberships.filter((x) => istDate(x.created_at) === day && x.renewed_from).length,
      payments.filter((p) => istDate(p.paid_at) === day).reduce((s, p) => s + Number(p.amount || 0), 0),
      members.filter((m) => istDate(m.created_at) === day).length]),
  ];
  return tabs;
}

async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("GOOGLE_SHEETS_API_KEY")!,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheets [${res.status}]: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function sync(sb: any) {
  const tabs = await buildTabs(sb);
  let id = await getCred(sb, "sheets_backup_id");
  if (!id) {
    const created = await gw("/spreadsheets", {
      method: "POST",
      body: JSON.stringify({ properties: { title: "All In One Wellness — CRM Backup", timeZone: TZ, locale: "en_GB" }, sheets: Object.keys(tabs).map((t) => ({ properties: { title: t } })) }),
    });
    id = created.spreadsheetId as string;
    await setCred(sb, "sheets_backup_id", id);
  }
  const meta = await gw(`/spreadsheets/${id}?fields=sheets.properties.title`);
  const existing = new Set((meta.sheets ?? []).map((s: any) => s.properties.title));
  const missing = Object.keys(tabs).filter((t) => !existing.has(t));
  if (missing.length) {
    await gw(`/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: missing.map((t) => ({ addSheet: { properties: { title: t } } })) }) });
  }
  await gw(`/spreadsheets/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: Object.keys(tabs).map((t) => `'${t}'`) }) });
  await gw(`/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data: Object.entries(tabs).map(([t, values]) => ({ range: `'${t}'!A1`, values })) }),
  });
  return { id, rows: Object.fromEntries(Object.entries(tabs).map(([t, v]) => [t, v.length - 1])) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = db();
  try {
    const body = await req.json().catch(() => ({}));
    const action = ["sync", "status", "export"].includes(body?.action) ? body.action : "sync";

    // Auth: cron secret or signed-in admin
    const cronSecret = req.headers.get("x-cron-secret");
    const stored = await getCred(sb, "sheets_cron_secret");
    let ok = !!cronSecret && !!stored && cronSecret === stored;
    if (!ok) {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (token) {
        const { data } = await sb.auth.getUser(token);
        if (data.user) {
          const { data: isAdmin } = await sb.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
          ok = !!isAdmin;
        }
      }
    }
    if (!ok) return json({ error: "Only admins can use backups" }, 403);

    if (action === "status") {
      const [id, at, status] = await Promise.all(["sheets_backup_id", "sheets_last_sync_at", "sheets_last_sync_status"].map((k) => getCred(sb, k)));
      return json({ spreadsheetId: id, url: id ? `https://docs.google.com/spreadsheets/d/${id}` : null, lastSyncAt: at, lastStatus: status });
    }
    if (action === "export") return json({ tabs: await buildTabs(sb) });

    try {
      const r = await sync(sb);
      await setCred(sb, "sheets_last_sync_at", new Date().toISOString());
      await setCred(sb, "sheets_last_sync_status", "ok");
      return json({ success: true, url: `https://docs.google.com/spreadsheets/d/${r.id}`, rows: r.rows });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("sync failed", msg);
      await setCred(sb, "sheets_last_sync_at", new Date().toISOString());
      await setCred(sb, "sheets_last_sync_status", msg.slice(0, 500));
      return json({ success: false, error: msg }, 502);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
