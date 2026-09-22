// One-off helper: pushes the CRM's automatic message bodies to Meta for
// approval as WhatsApp templates and records the mapping back on the rows.
// The access token stays server-side and is never returned or logged.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const WABA_ID = "1397404588576888";
const LANG = "en";

const SAMPLES: Record<string, string> = {
  name: "Pawan",
  full_name: "Pawan Tripathi",
  mobile: "9815064617",
  activation_code: "482913",
  joining_date: "22/09/2026",
  plan_name: "UMS 30",
  total_servings: "30",
  used_servings: "5",
  price: "7,500",
  payment_mode: "UPI",
  end_date: "22/10/2026",
  remaining: "25",
  renewal_days_left: "7",
  trial_end_date: "25/09/2026",
  trial_days_left: "2",
  milestone: "5 kg lost",
  issued_servings: "2",
  issue_reason: "pack and give",
  daily_change: "0.3 kg",
  last_weight: "78.4",
  weight_change: "4.2 kg",
  weight: "78.1",
  used_today: "1",
  date: "22/09/2026",
  code: "AIOW-1042",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "missing token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let only: string[] | null = null;
  try {
    const parsedBody = await req.json();
    if (Array.isArray(parsedBody?.triggers)) only = parsedBody.triggers as string[];
  } catch { /* no body */ }

  let query = supabase
    .from("wellness_notification_templates")
    .select("id, trigger_key, message_template, channel, active")
    .eq("channel", "whatsapp")
    .eq("active", true);
  if (only) query = query.in("trigger_key", only);
  const { data: rows, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];

  for (const row of rows ?? []) {
    const vars: string[] = [];
    const body = String(row.message_template).replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      let idx = vars.indexOf(key);
      if (idx === -1) {
        vars.push(key);
        idx = vars.length - 1;
      }
      return `{{${idx + 1}}}`;
    });

    const components: Record<string, unknown>[] = [
      vars.length
        ? {
          type: "BODY",
          text: body,
          example: { body_text: [vars.map((v) => SAMPLES[v] ?? "Sample")] },
        }
        : { type: "BODY", text: body },
    ];

    const res = await fetch(`https://graph.facebook.com/v25.0/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.trigger_key,
        language: LANG,
        category: "UTILITY",
        components,
      }),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch { /* keep raw */ }

    if (res.ok) {
      await supabase
        .from("wellness_notification_templates")
        .update({
          template_name: row.trigger_key,
          template_language: LANG,
          variables: vars,
        })
        .eq("id", row.id);
    }

    results.push({
      trigger: row.trigger_key,
      ok: res.ok,
      status: res.status,
      variables: vars,
      meta: res.ok ? parsed : (parsed as { error?: unknown }).error ?? text,
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
