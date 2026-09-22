// One-off helper: submits the check-in confirmation template to Meta for approval.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("META_ACCESS_TOKEN");
  const wabaId = "1397404588576888";
  if (!token) {
    return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = {
    name: "checkin_approved_v2",
    language: "en",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Hi {{1}}, your attendance at All In One Wellness on {{2}} is confirmed.\n\n" +
          "Today's weight: {{3}} kg ({{4}} since you started).\n\n" +
          "Change from last reading: {{5}} (last: {{6}} kg).\n\n" +
          "Servings used today: 1. Servings left: {{7}}.\n\n" +
          "Plan valid till: {{8}}.\n\n" +
          "Keep going — see you at your next session!\n\nTeam All In One Wellness",
        example: {
          body_text: [[
            "Pawan",
            "22 Sep 2026",
            "78.4",
            "-7.1 kg",
            "-0.4 kg",
            "78.8",
            "12",
            "30 Oct 2026",
          ]],
        },
      },
    ],
  };

  const res = await fetch(`https://graph.facebook.com/v25.0/${wabaId}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, meta: text }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
