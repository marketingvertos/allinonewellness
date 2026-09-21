import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders, hmacHex, json, timingSafeEqual } from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!WEBHOOK_SECRET) return json({ error: "Webhook not configured" }, 503);

  const expected = await hmacHex(WEBHOOK_SECRET, raw);
  if (!timingSafeEqual(expected, signature)) {
    console.error("razorpay-webhook: bad signature");
    return json({ error: "Invalid signature" }, 401);
  }

  try {
    const event = JSON.parse(raw);
    const kind = String(event?.event ?? "");
    const payment = event?.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    if (!razorpayOrderId) return json({ ok: true, skipped: kind });

    const { data: order } = await admin
      .from("razorpay_orders")
      .select("id, status")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();
    if (!order) return json({ ok: true, skipped: "unknown order" });

    if (kind === "payment.captured") {
      if (order.status === "paid") return json({ ok: true, skipped: "already paid" });
      const { error } = await admin.rpc("fulfil_online_payment", {
        p_order_id: order.id,
        p_payment_id: String(payment.id),
      });
      if (error) throw error;
    } else if (kind === "payment.failed" && order.status === "created") {
      await admin
        .from("razorpay_orders")
        .update({
          status: "failed",
          razorpay_payment_id: String(payment.id),
          failure_reason: payment?.error_description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("razorpay-webhook", e);
    return json({ error: (e as Error).message }, 500);
  }
});
