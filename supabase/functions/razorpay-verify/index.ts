import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  RAZORPAY_KEY_SECRET,
  corsHeaders,
  hmacHex,
  json,
  timingSafeEqual,
} from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "");
    const razorpayOrderId = String(body?.razorpayOrderId ?? "");
    const paymentId = String(body?.razorpayPaymentId ?? "");
    const signature = String(body?.razorpaySignature ?? "");
    if (!orderId || !razorpayOrderId || !paymentId || !signature) {
      return json({ error: "Incomplete payment details." }, 400);
    }

    const expected = await hmacHex(RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`);
    if (!timingSafeEqual(expected, signature)) {
      return json({ error: "Payment could not be verified." }, 400);
    }

    const { data: order } = await admin
      .from("razorpay_orders")
      .select("id, member_id, razorpay_order_id, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.razorpay_order_id !== razorpayOrderId) {
      return json({ error: "Order not found." }, 404);
    }

    // The order must belong to the signed-in member.
    const { data: member } = await admin
      .from("wellness_members")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member || member.id !== order.member_id) return json({ error: "Not authorized" }, 403);

    const { data: result, error } = await admin.rpc("fulfil_online_payment", {
      p_order_id: order.id,
      p_payment_id: paymentId,
    });
    if (error) throw error;

    return json({ ok: true, result });
  } catch (e) {
    console.error("razorpay-verify", e);
    return json({ error: (e as Error).message ?? "Something went wrong." }, 500);
  }
});
