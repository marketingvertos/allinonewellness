// Temporary diagnostic: reads one approved template's structure from Meta.
import { corsHeaders, json, loadWhatsAppConfig, serviceClient } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = serviceClient();
  const cfg = await loadWhatsAppConfig(supabase);
  const { data: waba } = await supabase
    .from("integration_credentials")
    .select("value")
    .eq("key", "whatsapp_waba_id")
    .maybeSingle();
  const url =
    `${cfg.apiUrl}/${waba?.value}/message_templates?fields=name,status,language,components&limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  const body = await res.json();
  const list = (body?.data || []).filter((t: { name: string }) =>
    String(t.name).startsWith("checkin_approved")
  );
  return json({ status: res.status, list, error: body?.error ?? null });
});
