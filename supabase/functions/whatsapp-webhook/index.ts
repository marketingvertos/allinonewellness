// Public webhook for WhatsApp delivery receipts and inbound replies.
// Supports both WachatSender and Meta Cloud payload shapes.

import {
  canUpgradeStatus,
  corsHeaders,
  json,
  last10,
  loadWhatsAppConfig,
  serviceClient,
} from "../_shared/whatsapp.ts";
import {
  applyMessageStatus,
  finishWebhookLog,
  logWebhookEvent,
  resolveConversation,
  touchConversation,
} from "../_shared/whatsappService.ts";

async function verifySignature(
  appSecret: string,
  signature: string | null,
  raw: string,
): Promise<boolean> {
  if (!appSecret) return true; // signature check skipped until app secret is configured
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(raw),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature.slice(7) === expected;
}

// deno-lint-ignore no-explicit-any
type Client = any;

async function isDuplicateInbound(
  supabase: Client,
  phone: string,
  providerId: string | null,
  text: string,
): Promise<boolean> {
  if (providerId) {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("provider_message_id", providerId)
      .eq("direction", "inbound")
      .maybeSingle();
    return Boolean(data);
  }
  const since = new Date(Date.now() - 8_000).toISOString();
  const { data: recent } = await supabase
    .from("whatsapp_messages")
    .select("id, message_content")
    .eq("phone", phone)
    .eq("direction", "inbound")
    .gte("created_at", since)
    .limit(10);
  return (recent || []).some((r: { message_content: string | null }) =>
    (r.message_content || "") === text
  );
}

/** Delivery callbacks without a message id: match the latest outbound to this number. */
async function findRecentOutboundByPhone(
  supabase: Client,
  phone: string,
): Promise<string | null> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("direction", "outbound")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function insertInboundOnce(
  supabase: Client,
  message: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from("whatsapp_messages").insert(message);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

// deno-lint-ignore no-explicit-any
function extractText(msg: any): string {
  if (msg?.text?.body) return msg.text.body;
  if (msg?.button?.text) return msg.button.text;
  if (msg?.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg?.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg?.type) return `[${msg.type} message]`;
  return "[unsupported message]";
}

async function findMember(
  supabase: Client,
  phone: string,
): Promise<{ id: string; full_name: string } | null> {
  const { data } = await supabase
    .from("wellness_members")
    .select("id, full_name")
    .ilike("mobile_number", `%${phone}%`)
    .limit(1);
  return data?.[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = serviceClient();
  const cfg = await loadWhatsAppConfig(supabase);

  // ---- Meta webhook verification handshake ----
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && cfg.verifyToken && token === cfg.verifyToken) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const ok = await verifySignature(
      cfg.appSecret,
      req.headers.get("x-hub-signature-256"),
      raw,
    );
    if (!ok) {
      console.warn("whatsapp-webhook: invalid signature");
      return json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(raw || "{}");
    const webhookLogId = await logWebhookEvent(supabase, {
      eventType: "received",
      providerMessageId: payload?.message?.wamid || payload?.message?.message_id ||
        payload?.message?.id || null,
      phone: payload?.contact?.phone_number || null,
      payload,
    });

    let inbound = 0;
    let statuses = 0;

    // ---- WachatSender payload format ----
    if (payload?.contact || payload?.message) {
      const contact = payload.contact || {};
      const msg = payload.message || {};
      const phone = last10(contact.phone_number || msg.phone_number || msg.to);
      const rawStatus = String(msg.status || "").toLowerCase();
      const providerId = msg.wamid || msg.message_id || msg.id || null;
      const mapped = ["sent", "delivered", "read", "failed"].includes(rawStatus)
        ? rawStatus as "sent" | "delivered" | "read" | "failed"
        : null;

      if (mapped) {
        let existing: { id: string; status: string } | null = null;
        if (providerId) {
          const { data } = await supabase
            .from("whatsapp_messages")
            .select("id, status")
            .eq("provider_message_id", providerId)
            .maybeSingle();
          existing = data ?? null;
        }
        if (!existing && phone) {
          const matchedId = await findRecentOutboundByPhone(supabase, phone);
          if (matchedId) {
            const { data } = await supabase
              .from("whatsapp_messages")
              .select("id, status")
              .eq("id", matchedId)
              .maybeSingle();
            existing = data ?? null;
          }
        }
        if (existing && canUpgradeStatus(existing.status, mapped)) {
          await applyMessageStatus(
            supabase,
            existing.id,
            mapped,
            msg.error || msg.errors?.[0]?.title || "Delivery failed at WhatsApp",
          );
          statuses++;
        }
        await finishWebhookLog(
          supabase,
          webhookLogId,
          existing ? "processed" : "ignored",
          {
            eventType: `status_${mapped}`,
            phone,
            providerMessageId: providerId,
            error: existing ? null : "No matching outbound message",
          },
        );
        return json({ success: true, inbound, statuses, provider: "wachatsender" });
      }

      if (!phone) {
        await finishWebhookLog(supabase, webhookLogId, "ignored", {
          eventType: "inbound",
          error: "No phone number in payload",
        });
        return json({ success: true, note: "no phone" });
      }

      const member = await findMember(supabase, phone);
      const mediaUrl = typeof msg.media === "string"
        ? msg.media
        : msg.media?.url || msg.media?.link || null;
      const text = msg.body || msg.text ||
        (mediaUrl ? "[media message]" : "[unsupported message]");
      const content = mediaUrl ? `${text}\n${mediaUrl}` : text;

      if (await isDuplicateInbound(supabase, phone, providerId, content)) {
        await finishWebhookLog(supabase, webhookLogId, "duplicate", {
          eventType: "inbound",
          phone,
          providerMessageId: providerId,
        });
        return json({ success: true, duplicate: true });
      }

      const conversation = await resolveConversation(supabase, {
        phone,
        memberId: member?.id ?? null,
        displayName: contact.first_name || contact.name || member?.full_name || null,
      });
      const claimed = await insertInboundOnce(supabase, {
        member_id: member?.id ?? null,
        conversation_id: conversation?.id ?? null,
        phone,
        source_module: "inbound",
        message_type: mediaUrl ? "media" : "text",
        direction: "inbound",
        message_content: content,
        status: "received",
        provider_message_id: providerId,
      });
      if (!claimed) {
        await finishWebhookLog(supabase, webhookLogId, "duplicate", {
          eventType: "inbound",
          phone,
          providerMessageId: providerId,
        });
        return json({ success: true, duplicate: true });
      }
      inbound++;
      if (conversation) {
        await touchConversation(supabase, conversation.id, {
          direction: "inbound",
          preview: content,
        });
      }
      await finishWebhookLog(supabase, webhookLogId, "processed", {
        eventType: "inbound",
        phone,
        providerMessageId: providerId,
      });
      return json({ success: true, inbound, statuses, provider: "wachatsender" });
    }

    // ---- Meta Cloud payload format ----
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {};

        for (const msg of value.messages || []) {
          const from = last10(msg.from);
          if (!from) continue;
          const content = extractText(msg);
          if (await isDuplicateInbound(supabase, from, msg.id ?? null, content)) continue;
          const member = await findMember(supabase, from);
          const conversation = await resolveConversation(supabase, {
            phone: from,
            memberId: member?.id ?? null,
            displayName: value?.contacts?.[0]?.profile?.name || member?.full_name || null,
          });
          const claimed = await insertInboundOnce(supabase, {
            member_id: member?.id ?? null,
            conversation_id: conversation?.id ?? null,
            phone: from,
            source_module: "inbound",
            message_type: "text",
            direction: "inbound",
            message_content: content,
            status: "received",
            provider_message_id: msg.id ?? null,
          });
          if (!claimed) continue;
          inbound++;
          if (conversation) {
            await touchConversation(supabase, conversation.id, {
              direction: "inbound",
              preview: content,
            });
          }
        }

        for (const st of value.statuses || []) {
          const providerId = st.id;
          const next = String(st.status || "").toLowerCase();
          if (!providerId || !next) continue;
          if (!["sent", "delivered", "read", "failed"].includes(next)) continue;
          const { data: existing } = await supabase
            .from("whatsapp_messages")
            .select("id, status")
            .eq("provider_message_id", providerId)
            .maybeSingle();
          if (!existing || !canUpgradeStatus(existing.status, next)) continue;
          await applyMessageStatus(
            supabase,
            existing.id,
            next as "sent" | "delivered" | "read" | "failed",
            st.errors?.[0]?.title || "Delivery failed",
          );
          statuses++;
        }
      }
    }

    await finishWebhookLog(supabase, webhookLogId, "processed", {
      eventType: inbound ? "inbound" : statuses ? "status" : "received",
    });
    return json({ success: true, inbound, statuses });
  } catch (e) {
    console.error("whatsapp-webhook error", e);
    return json({ success: true, note: "ignored" }, 200);
  }
});
