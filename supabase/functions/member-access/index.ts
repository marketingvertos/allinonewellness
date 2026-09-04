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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const memberId = String(body?.memberId ?? "");
    if (!["status", "create", "reset", "unlink"].includes(action)) return json({ error: "Invalid action" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(memberId)) return json({ error: "Invalid member id" }, 400);

    const { data: member, error: memberErr } = await admin
      .from("wellness_members")
      .select("id, full_name, mobile_number, user_id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberErr || !member) return json({ error: "Member not found" }, 404);

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

    if (action === "create") {
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
