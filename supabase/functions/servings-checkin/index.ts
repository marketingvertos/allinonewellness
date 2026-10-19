// Servings-based check-in fallback: memberships stay usable while servings remain,
// regardless of plan end date. Runs the existing RPC first; only when it answers
// "renew_required" do we apply the servings rule here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("self_request"), code: z.string().min(1).max(200), weight: z.number().positive().max(500).nullable().optional() }),
  z.object({ action: z.literal("staff_checkin"), member_id: z.string().uuid(), method: z.enum(["qr_scan", "barcode_scan", "admin_manual", "staff_entry"]).optional() }),
  z.object({ action: z.literal("approve"), request_id: z.string().uuid(), weight: z.number().positive().max(500).nullable().optional() }),
]);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const NO_SERVINGS = { status: "renew_required", message: "No servings left on your plan. Please renew — contact your coach." };

// deno-lint-ignore no-explicit-any
type Admin = any;

async function servingMembership(admin: Admin, memberId: string) {
  const today = istToday();
  const { data: trial } = await admin.from("wellness_trials").select("id").eq("member_id", memberId)
    .eq("status", "active").gte("end_date", today).limit(1);
  if (trial?.length) return null;
  const { data } = await admin.from("wellness_memberships").select("id, remaining_servings, used_servings, created_by")
    .eq("member_id", memberId).in("status", ["active", "expiring_soon"]).gt("remaining_servings", 0)
    .order("start_date").limit(1);
  return data?.[0] ?? null;
}

async function deduct(admin: Admin, memberId: string, method: string, staffId: string) {
  const today = istToday();
  const { data: existing } = await admin.from("wellness_attendance").select("id").eq("member_id", memberId).eq("visit_date", today).limit(1);
  if (existing?.length) return { result: { status: "duplicate", message: "Already checked in today." } };
  const ms = await servingMembership(admin, memberId);
  if (!ms) return { result: NO_SERVINGS };
  const after = ms.remaining_servings - 1;
  const { data: upd, error: uErr } = await admin.from("wellness_memberships")
    .update({ remaining_servings: after, used_servings: ms.used_servings + 1 })
    .eq("id", ms.id).eq("remaining_servings", ms.remaining_servings).select("id");
  if (uErr) throw uErr;
  if (!upd?.length) return { result: { status: "error", message: "Balance changed, please try again." } };
  const { data: att, error: aErr } = await admin.from("wellness_attendance").insert({
    member_id: memberId, membership_id: ms.id, checkin_method: method, serving_deducted: true,
    remaining_balance_snapshot: after, staff_id: staffId,
  }).select("id").single();
  if (aErr) {
    await admin.from("wellness_memberships").update({ remaining_servings: ms.remaining_servings, used_servings: ms.used_servings }).eq("id", ms.id);
    if (aErr.code === "23505") return { result: { status: "duplicate", message: "Already checked in today." } };
    throw aErr;
  }
  await admin.from("serving_transactions").insert({
    member_id: memberId, membership_id: ms.id, attendance_id: att.id, txn_type: "daily_deduction",
    change: -1, balance_after: after, created_by: staffId ?? ms.created_by,
  });
  return { result: { status: "ok", mode: "membership", remaining: after }, attendanceId: att.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error: uErr } = await user.auth.getUser(auth.slice(7));
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
    const uid = u.user.id;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    if (b.action === "self_request") {
      const { data, error } = await user.rpc("member_self_checkin", { p_code: b.code, p_weight: b.weight ?? null });
      if (error) return json({ error: error.message }, 400);
      if (data?.status !== "renew_required") return json(data);
      const { data: mem } = await admin.from("wellness_members").select("id").eq("user_id", uid).limit(1);
      const memberId = mem?.[0]?.id;
      if (!memberId) return json(data);
      const ms = await servingMembership(admin, memberId);
      if (!ms) return json(data);
      const { data: r, error: rErr } = await admin.from("wellness_checkin_requests").insert({
        member_id: memberId, membership_id: ms.id, request_date: istToday(), requested_weight: b.weight ?? null,
      }).select("id").single();
      if (rErr) throw rErr;
      return json({ status: "pending", request_id: r.id, message: "Your check-in request has been sent for approval." });
    }

    const { data: isStaff } = await admin.rpc("is_wellness_staff", { _user_id: uid });
    if (!isStaff) return json({ error: "Not authorized." }, 403);

    if (b.action === "staff_checkin") {
      const method = b.method ?? "staff_entry";
      const { data, error } = await user.rpc("checkin_member", { p_member_id: b.member_id, p_method: method });
      if (error) return json({ error: error.message }, 400);
      if (data?.status !== "renew_required") return json(data);
      return json((await deduct(admin, b.member_id, method, uid)).result);
    }

    // approve
    const { data, error } = await user.rpc("approve_checkin_request", { p_request_id: b.request_id, p_weight: b.weight ?? null });
    if (error) return json({ error: error.message }, 400);
    if (data?.status !== "renew_required") return json(data);
    const { data: rq } = await admin.from("wellness_checkin_requests").select("*").eq("id", b.request_id).single();
    if (!rq || rq.status !== "pending") return json({ status: "already_decided", message: "This request was already handled." });
    const d = await deduct(admin, rq.member_id, "qr_scan", uid);
    if (d.result.status !== "ok") return json(d.result);
    await admin.from("wellness_checkin_requests").update({
      status: "approved", decided_by: uid, decided_at: new Date().toISOString(), attendance_id: d.attendanceId,
      requested_weight: b.weight ?? rq.requested_weight,
    }).eq("id", rq.id).eq("status", "pending");
    const w = b.weight ?? rq.requested_weight;
    const out: Record<string, unknown> = { ...d.result };
    if (w && w > 0) {
      const { error: wErr } = await admin.from("weight_tracking").insert({
        member_id: rq.member_id, recorded_date: istToday(), weight: w, recorded_by: uid, notes: "Recorded at check-in",
      });
      if (!wErr) { await admin.from("wellness_members").update({ current_weight: w }).eq("id", rq.member_id); out.weight_recorded = w; }
      else out.weight_error = true;
    }
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
