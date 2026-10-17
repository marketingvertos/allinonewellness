import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeMobile = (m: string) => {
  const digits = (m ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};
const mobileToEmail = (m: string) => `${normalizeMobile(m)}@members.vertos.in`;

/** Default password handed to new members by the front desk. */
const DEFAULT_MEMBER_PASSWORD = "Shri@@1008";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Only wellness staff (any assigned CRM role) may manage member logins.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!roles?.length) return json({ error: "Not authorized" }, 403);
    const isManager = roles.some((r) => r.role === "admin" || r.role === "manager");
    const isAdmin = roles.some((r) => r.role === "admin");

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const memberId = String(body?.memberId ?? "");
    if (
      !["status", "create", "ensure", "reset", "unlink", "missing_logins", "create_missing", "delete", "miw_remove_participant", "miw_clear_pending"].includes(action)
    )
      return json({ error: "Invalid action" }, 400);

    // Staff-only: settle unfinished online MIW payments before a desk registration.
    if (action === "miw_clear_pending") {
      const challengeId = String(body?.challengeId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^[0-9a-f-]{36}$/i.test(memberId))
        return json({ error: "Invalid request" }, 400);
      const { data: orders } = await admin
        .from("razorpay_orders")
        .select("id, razorpay_order_id, amount_paise")
        .eq("member_id", memberId)
        .eq("miw_challenge_id", challengeId)
        .eq("status", "created");
      const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
      for (const o of orders ?? []) {
        const res = await fetch(`https://api.razorpay.com/v1/orders/${o.razorpay_order_id}/payments`, {
          headers: { Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
        });
        if (!res.ok) return json({ error: "Could not check the online payment with Razorpay. Try again." }, 502);
        const list = await res.json();
        // deno-lint-ignore no-explicit-any
        const paid = (list?.items ?? []).find((p: any) => p.status === "captured" && p.amount === o.amount_paise);
        if (paid) {
          const { error } = await admin.rpc("miw_fulfil_payment", { p_order_id: o.id, p_payment_id: String(paid.id) });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true, paidOnline: true });
        }
        // deno-lint-ignore no-explicit-any
        if ((list?.items ?? []).some((p: any) => p.status === "authorized"))
          return json({ error: "An online payment is still being processed by the bank. Try again in a few minutes." }, 409);
        await admin.from("razorpay_orders")
          .update({ status: "cancelled", failure_reason: "Not paid; cleared at desk registration", updated_at: new Date().toISOString() })
          .eq("id", o.id).eq("status", "created");
      }
      return json({ ok: true, paidOnline: false });
    }

    // Staff-only: remove a member from an MIW challenge, with an audit note on the profile.
    if (action === "miw_remove_participant") {
      const participantId = String(body?.participantId ?? "");
      const reason = String(body?.reason ?? "").trim().slice(0, 500);
      if (!/^[0-9a-f-]{36}$/i.test(participantId)) return json({ error: "Invalid participant id" }, 400);

      const { data: part, error: partErr } = await admin
        .from("miw_participants")
        .select("id, member_id, challenge_id, miw_challenges(name)")
        .eq("id", participantId)
        .maybeSingle();
      if (partErr) return json({ error: partErr.message }, 400);
      if (!part) return json({ error: "Participant not found or already removed" }, 404);

      const { data: pays } = await admin.from("miw_payments").select("amount, mode").eq("participant_id", participantId);
      const total = (pays ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);

      const { error: payDelErr } = await admin.from("miw_payments").delete().eq("participant_id", participantId);
      if (payDelErr) return json({ error: payDelErr.message }, 400);
      const { data: removed, error: partDelErr } = await admin
        .from("miw_participants")
        .delete()
        .eq("id", participantId)
        .select("id");
      if (partDelErr) return json({ error: partDelErr.message }, 400);
      if (!removed?.length) return json({ error: "Participant could not be removed" }, 400);

      const { count: remaining } = await admin
        .from("miw_participants")
        .select("id", { count: "exact", head: true })
        .eq("member_id", part.member_id);
      if (!remaining) {
        const { data: m } = await admin.from("wellness_members").select("tags").eq("id", part.member_id).maybeSingle();
        const tags = ((m?.tags as string[] | null) ?? []).filter((t) => t !== "miw");
        await admin.from("wellness_members").update({ tags }).eq("id", part.member_id);
      }

      // deno-lint-ignore no-explicit-any
      const challengeName = (part as any).miw_challenges?.name ?? "MIW challenge";
      const modes = (pays ?? []).map((p) => `₹${p.amount} ${p.mode}`).join(", ");
      await admin.from("member_notes").insert({
        member_id: part.member_id,
        created_by: userData.user.id,
        note: `Removed from MIW challenge "${challengeName}".${total ? ` Registration payment of ₹${total} (${modes}) removed from MIW revenue.` : ""}${reason ? ` Reason: ${reason}` : ""}`,
      });

      return json({ ok: true, removedPayments: total });
    }

    // Bulk helpers: every non-lead member that has no portal login yet.
    if (action === "missing_logins" || action === "create_missing") {
      const { data: pending, error: pendingErr } = await admin
        .from("wellness_members")
        .select("id, full_name, mobile_number")
        .is("user_id", null)
        .neq("status", "lead")
        .order("full_name");
      if (pendingErr) return json({ error: pendingErr.message }, 400);

      if (action === "missing_logins") return json({ members: pending ?? [] });

      const created: { id: string; full_name: string; mobile_number: string }[] = [];
      const failed: { full_name: string; mobile_number: string; error: string }[] = [];

      for (const m of pending ?? []) {
        const mobile = normalizeMobile(m.mobile_number);
        if (mobile.length !== 10) {
          failed.push({ full_name: m.full_name, mobile_number: m.mobile_number, error: "Invalid mobile number" });
          continue;
        }
        const memberEmail = `${mobile}@members.vertos.in`;
        const { data: made, error: madeErr } = await admin.auth.admin.createUser({
          email: memberEmail,
          password: DEFAULT_MEMBER_PASSWORD,
          email_confirm: true,
          user_metadata: {
            account_type: "wellness_member",
            mobile_number: mobile,
            full_name: m.full_name,
            must_change_password: true,
          },
        });
        let authId = made?.user?.id ?? null;
        if (madeErr) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users?.find((u) => u.email?.toLowerCase() === memberEmail);
          if (!existing) {
            failed.push({ full_name: m.full_name, mobile_number: m.mobile_number, error: madeErr.message });
            continue;
          }
          authId = existing.id;
          await admin.auth.admin.updateUserById(existing.id, {
            password: DEFAULT_MEMBER_PASSWORD,
            user_metadata: { ...existing.user_metadata, must_change_password: true },
          });
        }
        await admin.from("wellness_members").update({ user_id: authId }).eq("id", m.id);
        created.push({ id: m.id, full_name: m.full_name, mobile_number: mobile });
      }

      return json({ created, failed, password: DEFAULT_MEMBER_PASSWORD });
    }

    if (!/^[0-9a-f-]{36}$/i.test(memberId)) return json({ error: "Invalid member id" }, 400);

    const { data: member, error: memberErr } = await admin
      .from("wellness_members")
      .select("id, full_name, mobile_number, user_id, referred_by_member_id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr || !member) return json({ error: "Member not found" }, 404);

    // Permanent removal of a member profile: full admins only.
    if (action === "delete") {
      if (!isAdmin) return json({ error: "Only super admins can delete a member profile." }, 403);

      // Members this person referred keep their records; only the link is cleared.
      const { data: referred } = await admin
        .from("wellness_members")
        .select("id")
        .eq("referred_by_member_id", memberId);
      const referredIds = (referred ?? []).map((r) => r.id);

      // FK guards that do not cascade.
      for (const t of ["miw_payments", "miw_participants"]) {
        const { error } = await admin.from(t).delete().eq("member_id", memberId);
        if (error) return json({ error: error.message }, 400);
      }
      const { error: payErr } = await admin.from("wellness_payments").delete().eq("member_id", memberId);
      if (payErr) return json({ error: payErr.message }, 400);

      for (const step of [
        admin.from("wellness_members").update({ referred_by_member_id: null }).eq("referred_by_member_id", memberId),
        admin.from("pink_card_ledger").update({ referred_member_id: null }).eq("referred_member_id", memberId),
        admin.from("whatsapp_messages").update({ member_id: null }).eq("member_id", memberId),
        admin.from("whatsapp_conversations").update({ member_id: null }).eq("member_id", memberId),
      ]) {
        const { error } = await step;
        if (error) return json({ error: error.message }, 400);
      }

      const { error: delErr } = await admin.from("wellness_members").delete().eq("id", memberId);
      if (delErr) return json({ error: delErr.message }, 400);

      if (member.user_id) {
        await admin.auth.admin.deleteUser(member.user_id).catch(() => undefined);
      }

      const recalcIds = [...referredIds, member.referred_by_member_id].filter(Boolean) as string[];
      for (const id of recalcIds) {
        const { error: recalcError } = await admin.rpc("recalc_network_counts", { p_member_id: id });
        if (recalcError) console.error("Network recalculation failed", recalcError.message);
      }

      return json({ status: "deleted", full_name: member.full_name });
    }

    const email = mobileToEmail(member.mobile_number);
    if (normalizeMobile(member.mobile_number).length !== 10)
      return json({ error: "Member mobile number must be a valid 10-digit number." }, 400);

    if (action === "status") {
      return json({ hasLogin: !!member.user_id, loginId: email });
    }

    const rawPassword = typeof body?.password === "string" && body.password.trim() ? body.password.trim() : null;
    if (rawPassword && rawPassword.length < 8)
      return json({ error: "Password must be at least 8 characters." }, 400);
    const password = rawPassword ?? DEFAULT_MEMBER_PASSWORD;

    // "ensure" is the idempotent variant used automatically when a member
    // starts a plan: create the login only when it does not exist yet.
    if (action === "ensure" && member.user_id) {
      return json({ status: "exists", loginId: email });
    }

    if (action === "create" || action === "ensure") {
      if (member.user_id) return json({ error: "This member already has a portal login." }, 409);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          account_type: "wellness_member",
          mobile_number: normalizeMobile(member.mobile_number),
          full_name: member.full_name,
          must_change_password: true,
        },
      });

      let authUserId = created?.user?.id ?? null;
      if (createErr) {
        // The auth user may already exist from a previous self-activation attempt.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) return json({ error: createErr.message }, 400);
        authUserId = existing.id;
        await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...existing.user_metadata, must_change_password: true },
        });
      }

      await admin.from("wellness_members").update({ user_id: authUserId }).eq("id", memberId);
      return json({ status: "ok", loginId: email, password });
    }

    if (action === "reset") {
      if (!member.user_id) return json({ error: "This member has no portal login yet." }, 400);
      const { data: existing } = await admin.auth.admin.getUserById(member.user_id);
      const { error: updErr } = await admin.auth.admin.updateUserById(member.user_id, {
        password,
        user_metadata: { ...(existing?.user?.user_metadata ?? {}), must_change_password: true },
      });
      if (updErr) return json({ error: updErr.message }, 400);
      return json({ status: "ok", loginId: email, password });
    }

    // unlink
    if (!isManager) return json({ error: "Only admins and managers can remove portal access." }, 403);
    await admin.from("wellness_members").update({ user_id: null }).eq("id", memberId);
    return json({ status: "ok" });
  } catch (error) {
    return json({ error: (error as Error).message ?? "Unexpected error" }, 500);
  }
});
