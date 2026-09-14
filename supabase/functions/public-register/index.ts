// Public lead registration — open endpoint used by the /join page.
// No authentication: writes go through the service-role client so the
// wellness_members table itself stays closed to anonymous users.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { loadWhatsAppConfig } from "../_shared/whatsapp.ts";
import { sendWhatsApp } from "../_shared/whatsappService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));
const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));
const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), {
      message: "Out of range",
    });

const optionalEnum = <T extends string>(values: readonly [T, ...T[]]) =>
  z.enum(values).optional().or(z.literal("")).transform((v) => (v ? (v as T) : null));

const BodySchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  mobile_number: z.string().trim().min(10).max(15),
  alternate_mobile: optionalText(15),
  email: z.string().trim().email().max(255).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  gender: optionalEnum(["female", "male", "other"] as const),
  marital_status: optionalEnum(["single", "married", "prefer_not_say"] as const),
  member_mode: z.enum(["physical", "virtual"]).optional().default("physical"),
  goal: optionalEnum([
    "weight_loss",
    "fat_loss",
    "weight_management",
    "weight_gain",
    "general_wellness",
    "healthy_lifestyle",
    "body_transformation",
  ] as const),
  date_of_birth: optionalDate,
  anniversary_date: optionalDate,
  city: optionalText(80),
  height: optionalNumber(80, 250),
  joining_weight: optionalNumber(20, 300),
  target_weight: optionalNumber(20, 300),
  referrer_name: optionalText(100),
  health_issues: optionalText(1000),
  /** Hidden honeypot — real people never fill this in. */
  website: z.string().max(200).optional(),
});


const last10 = (m: string) => {
  const digits = (m ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const istToday = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Per-instance throttle: max 5 submissions per IP per 10 minutes. */
const hits = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (throttled(ip)) return json({ error: "Too many submissions. Please try again later." }, 429);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: "Please check the details you entered." }, 400);
    }
    const input = parsed.data;

    // Honeypot: pretend everything went fine, store nothing.
    if (input.website && input.website.trim()) return json({ ok: true });

    const mobile = last10(input.mobile_number);
    if (mobile.length !== 10) {
      return json({ error: "Please enter a valid 10-digit WhatsApp number." }, 400);
    }

    const { data: existing } = await supabase
      .from("wellness_members")
      .select("id")
      .ilike("mobile_number", `%${mobile}%`)
      .limit(1);
    if (existing?.length) {
      return json({ error: "This WhatsApp number is already registered with us." }, 409);
    }

    // Attribute the record to an admin account so created_by stays valid.
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (!adminRole?.user_id) return json({ error: "Registration is unavailable right now." }, 503);

    const { data: member, error: insertErr } = await supabase
      .from("wellness_members")
      .insert({
        full_name: input.full_name,
        mobile_number: mobile,
        date_of_birth: input.date_of_birth,
        marital_status: input.anniversary_date ? "married" : null,
        anniversary_date: input.anniversary_date,
        height: input.height,
        initial_weight: input.joining_weight,
        joining_date: istToday(),
        status: "lead",
        goal: "weight_loss",
        member_mode: "physical",
        tags: ["public_form"],
        created_by: adminRole.user_id,
      })
      .select("id, full_name")
      .maybeSingle();

    if (insertErr || !member) {
      console.error("public-register insert failed", insertErr);
      return json({ error: "We could not save your details. Please try again." }, 500);
    }

    const noteLines = [
      input.city ? `City: ${input.city}` : null,
      input.alternate_mobile ? `Alternate number: ${input.alternate_mobile}` : null,
      input.health_issues ? `Health issues: ${input.health_issues}` : null,
    ].filter(Boolean);
    if (noteLines.length) {
      await supabase.from("member_notes").insert({
        member_id: member.id,
        note: `Public registration form\n${noteLines.join("\n")}`,
        created_by: adminRole.user_id,
      });
    }

    // Team alert (best effort — never blocks the registration).
    try {
      const { data: alertRow } = await supabase
        .from("integration_credentials")
        .select("value")
        .eq("key", "lead_alert_phone")
        .maybeSingle();
      const alertPhone = last10(String(alertRow?.value ?? ""));
      if (alertPhone.length === 10) {
        const cfg = await loadWhatsAppConfig(supabase);
        const text = [
          "New registration from the public form",
          `Name: ${input.full_name}`,
          `WhatsApp: ${mobile}`,
          input.city ? `City: ${input.city}` : null,
          input.joining_weight ? `Weight: ${input.joining_weight} kg` : null,
        ].filter(Boolean).join("\n");
        await sendWhatsApp(supabase, cfg, { to: alertPhone, text }, {
          functionName: "public-register",
          sourceModule: "automation",
          isBot: true,
          logContent: text,
        });
      }
    } catch (e) {
      console.error("lead alert failed", e);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("public-register error", error);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});
