import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  corsHeaders,
  json,
  razorpayAuthHeader,
} from "../_shared/razorpay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** ₹250 of credit per Pink Card serving — same value the front desk uses. */
const PINK_CARD_SERVING_VALUE = 250;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: "Online payments are not configured yet." }, 503);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const planId = String(body?.planId ?? "");
    const usePinkCredits = Math.max(0, Number(body?.pinkCredits ?? 0) | 0);
    if (!planId) return json({ error: "Choose a plan first." }, 400);

    // The member is always resolved from the signed-in account, never from the request.
    const { data: member } = await admin
      .from("wellness_members")
      .select("id, full_name, mobile_number, email, pink_card_balance")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member) return json({ error: "No member profile found for this account." }, 403);

    const { data: plan } = await admin
      .from("wellness_plans")
      .select("id, name, price, active")
      .eq("id", planId)
      .maybeSingle();
    if (!plan || !plan.active) return json({ error: "That plan is not available." }, 400);

    // Renewal when there is a plan still running, otherwise a fresh activation.
    const { data: memberships } = await admin
      .from("wellness_memberships")
      .select("id, status, end_date")
      .eq("member_id", member.id)
      .in("status", ["active", "expiring_soon"])
      .order("end_date", { ascending: false })
      .limit(1);
    const current = memberships?.[0] ?? null;

    const price = Number(plan.price);
    const maxCredits = Math.min(
      member.pink_card_balance ?? 0,
      Math.floor(price / PINK_CARD_SERVING_VALUE),
    );
    const credits = Math.min(usePinkCredits, maxCredits);
    const payable = Math.max(price - credits * PINK_CARD_SERVING_VALUE, 0);
    if (payable <= 0) return json({ error: "Nothing left to pay online for this plan." }, 400);

    const amountPaise = Math.round(payable * 100);
    const receipt = `aiow_${Date.now().toString(36)}`;

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: razorpayAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: { member_id: member.id, plan_id: plan.id, plan: plan.name },
      }),
    });
    const rzpOrder = await rzpRes.json();
    if (!rzpRes.ok || !rzpOrder?.id) {
      console.error("razorpay order failed", rzpOrder);
      return json({ error: rzpOrder?.error?.description ?? "Could not start the payment." }, 502);
    }

    const { data: order, error: orderErr } = await admin
      .from("razorpay_orders")
      .insert({
        member_id: member.id,
        plan_id: plan.id,
        renew_membership_id: current?.id ?? null,
        context: current ? "renewal" : "activation",
        amount_paise: amountPaise,
        pink_credits: credits,
        razorpay_order_id: rzpOrder.id,
      })
      .select("id")
      .single();
    if (orderErr) throw orderErr;

    return json({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      keyId: RAZORPAY_KEY_ID,
      amountPaise,
      pinkCredits: credits,
      planName: plan.name,
      member: {
        name: member.full_name,
        email: member.email ?? "",
        contact: member.mobile_number ?? "",
      },
    });
  } catch (e) {
    console.error("razorpay-create-order", e);
    return json({ error: (e as Error).message ?? "Something went wrong." }, 500);
  }
});
