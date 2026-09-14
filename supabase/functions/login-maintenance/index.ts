import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const DEFAULT_MEMBER_PASSWORD = "Shri@@1008";

Deno.serve(async () => {
  const created: string[] = [];
  const removed: string[] = [];

  const { data: pending } = await admin
    .from("wellness_members")
    .select("id, full_name, mobile_number")
    .is("user_id", null)
    .neq("status", "lead");

  for (const m of pending ?? []) {
    const mobile = (m.mobile_number ?? "").replace(/\D/g, "").slice(-10);
    if (mobile.length !== 10) continue;
    const email = `${mobile}@members.vertos.in`;
    const { data: made } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_MEMBER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        account_type: "wellness_member",
        mobile_number: mobile,
        full_name: m.full_name,
        must_change_password: true,
      },
    });
    if (made?.user?.id) {
      await admin.from("wellness_members").update({ user_id: made.user.id }).eq("id", m.id);
      created.push(`${m.full_name} ${mobile}`);
    }
  }

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const { data: members } = await admin.from("wellness_members").select("user_id").not("user_id", "is", null);
  const linked = new Set((members ?? []).map((m) => m.user_id));
  for (const u of list?.users ?? []) {
    if (u.email?.endsWith("@members.vertos.in") && !linked.has(u.id)) {
      await admin.auth.admin.deleteUser(u.id);
      removed.push(u.email);
    }
  }

  return new Response(JSON.stringify({ created, removed }), { headers: { "Content-Type": "application/json" } });
});
