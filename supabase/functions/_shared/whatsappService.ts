// Centralized WhatsApp communication service for the wellness centre.
//
// Every module should send WhatsApp messages through `sendWhatsApp` so that
// conversations, message logs and API activity are recorded in one place.
// The provider layer (WachatSender / Meta) lives in `whatsapp.ts`.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildSendRequest,
  last10,
  parseSendResponse,
  SendInput,
  SendOutcome,
  WhatsAppConfig,
} from "./whatsapp.ts";

export type SourceModule =
  | "notification"
  | "manual"
  | "automation"
  | "inbound"
  | "diagnostics"
  | "other";

export interface ConversationRef {
  id: string;
  phone: string;
  member_id: string | null;
}

/** Finds (or creates) the conversation for a phone number. Never creates members. */
export async function resolveConversation(
  supabase: SupabaseClient,
  opts: {
    phone: string | null | undefined;
    memberId?: string | null;
    displayName?: string | null;
  },
): Promise<ConversationRef | null> {
  const phone = last10(opts.phone);
  if (phone.length !== 10) return null;

  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone, member_id, display_name")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.member_id && opts.memberId) patch.member_id = opts.memberId;
    if (!existing.display_name && opts.displayName) {
      patch.display_name = opts.displayName;
    }
    if (Object.keys(patch).length) {
      await supabase.from("whatsapp_conversations").update(patch).eq(
        "id",
        existing.id,
      );
    }
    return {
      id: existing.id,
      phone,
      member_id: (patch.member_id as string) ?? existing.member_id,
    };
  }

  let memberId = opts.memberId ?? null;
  let name = opts.displayName ?? null;
  if (!memberId) {
    const { data: members } = await supabase
      .from("wellness_members")
      .select("id, full_name")
      .ilike("mobile_number", `%${phone}%`)
      .limit(1);
    if (members?.[0]) {
      memberId = members[0].id;
      name = name || members[0].full_name;
    }
  }

  const { data: created, error } = await supabase
    .from("whatsapp_conversations")
    .insert({ phone, member_id: memberId, display_name: name, status: "open" })
    .select("id, phone, member_id")
    .maybeSingle();

  if (error || !created) {
    const { data: again } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone, member_id")
      .eq("phone", phone)
      .maybeSingle();
    return again ?? null;
  }
  return created;
}

/** Records one provider API interaction. Never stores credentials. */
export async function logApiCall(
  supabase: SupabaseClient,
  entry: {
    action: string;
    functionName: string;
    messageId?: string | null;
    phone?: string | null;
    ok: boolean;
    httpStatus?: number | null;
    providerCode?: string | number | null;
    providerMessageId?: string | null;
    error?: string | null;
    summary?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("whatsapp_api_logs").insert({
      action: entry.action,
      function_name: entry.functionName,
      message_id: entry.messageId ?? null,
      phone: last10(entry.phone) || null,
      ok: entry.ok,
      http_status: entry.httpStatus ?? null,
      provider_code: entry.providerCode != null
        ? String(entry.providerCode)
        : null,
      provider_message_id: entry.providerMessageId ?? null,
      error: entry.error ?? null,
      request_summary: entry.summary ?? {},
    });
  } catch (e) {
    console.error("whatsapp api log failed", e);
  }
}

/** Keeps the conversation header (preview / unread / timestamps) in sync. */
export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string,
  opts: {
    direction: "inbound" | "outbound";
    preview: string | null;
    incrementUnread?: boolean;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
    last_direction: opts.direction,
    last_message_preview: (opts.preview || "").slice(0, 160),
  };
  if (opts.direction === "inbound" && opts.incrementUnread !== false) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    patch.unread_count = (data?.unread_count ?? 0) + 1;
    patch.status = "open";
  }
  await supabase.from("whatsapp_conversations").update(patch).eq(
    "id",
    conversationId,
  );
}

export interface SendMeta {
  functionName: string;
  sourceModule: SourceModule;
  memberId?: string | null;
  sentBy?: string | null;
  displayName?: string | null;
  logContent?: string | null;
  messageType?: string | null;
  isBot?: boolean;
  retryOfMessageId?: string | null;
  skipMessageRow?: boolean;
}

export interface CentralSendResult extends SendOutcome {
  messageId: string | null;
  conversationId: string | null;
  httpStatus: number | null;
}

/** Single entry point for outbound WhatsApp traffic. */
export async function sendWhatsApp(
  supabase: SupabaseClient,
  cfg: WhatsAppConfig,
  input: SendInput,
  meta: SendMeta,
): Promise<CentralSendResult> {
  const { url, body, headers } = buildSendRequest(cfg, input);

  let outcome: SendOutcome = {
    ok: false,
    providerMessageId: null,
    error: null,
    errorCode: null,
    errorDetails: null,
  };
  let httpStatus: number | null = null;
  let rawSnippet = "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    const rawText = await res.text();
    rawSnippet = rawText.slice(0, 500);
    let result: unknown = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { raw: rawText };
    }
    outcome = parseSendResponse(cfg, res.ok, res.status, result);
  } catch (e) {
    outcome = {
      ok: false,
      providerMessageId: null,
      error: e instanceof Error ? e.message : "Network error",
      errorCode: null,
      errorDetails: null,
    };
  }

  const conversation = await resolveConversation(supabase, {
    phone: input.to,
    memberId: meta.memberId ?? null,
    displayName: meta.displayName ?? null,
  });

  const messageType = meta.messageType ||
    (input.templateName ? "template" : input.mediaUrl ? "document" : "text");
  const content = meta.logContent ?? input.text ??
    (input.templateName ? `[${input.templateName}]` : "");

  let messageId: string | null = null;
  if (!meta.skipMessageRow) {
    const errorDetail = [
      outcome.error,
      outcome.errorCode ? `code ${outcome.errorCode}` : null,
      outcome.errorDetails,
    ].filter(Boolean).join(" · ") || null;

    const { data: inserted } = await supabase
      .from("whatsapp_messages")
      .insert({
        member_id: meta.memberId ?? conversation?.member_id ?? null,
        conversation_id: conversation?.id ?? null,
        phone: last10(input.to) || null,
        direction: "outbound",
        template_name: input.templateName ?? null,
        message_type: messageType,
        source_module: meta.sourceModule,
        message_content: content,
        status: outcome.ok ? "sent" : "failed",
        error_message: outcome.ok ? null : errorDetail,
        provider_message_id: outcome.providerMessageId,
        sent_by: meta.sentBy ?? null,
        is_bot: meta.isBot ?? false,
        retry_of_message_id: meta.retryOfMessageId ?? null,
      })
      .select("id")
      .maybeSingle();
    messageId = inserted?.id ?? null;
  }

  if (conversation) {
    await touchConversation(supabase, conversation.id, {
      direction: "outbound",
      preview: content,
    });
  }

  await logApiCall(supabase, {
    action: input.templateName ? "send_template_message" : "send_message",
    functionName: meta.functionName,
    messageId,
    phone: input.to,
    ok: outcome.ok,
    httpStatus,
    providerCode: outcome.errorCode,
    providerMessageId: outcome.providerMessageId,
    error: outcome.ok ? null : outcome.error,
    summary: {
      source_module: meta.sourceModule,
      message_type: messageType,
      template: input.templateName ?? null,
      has_media: Boolean(input.mediaUrl),
      response: rawSnippet,
    },
  });

  return {
    ...outcome,
    messageId,
    conversationId: conversation?.id ?? null,
    httpStatus,
  };
}

// ---------------------------------------------------------------------------
// Webhook logging
// ---------------------------------------------------------------------------

function trimPayload(payload: unknown): unknown {
  try {
    const s = JSON.stringify(payload);
    return s.length > 8000 ? { truncated: true, raw: s.slice(0, 8000) } : payload;
  } catch {
    return null;
  }
}

export async function logWebhookEvent(
  supabase: SupabaseClient,
  entry: {
    eventType: string;
    phone?: string | null;
    providerMessageId?: string | null;
    payload?: unknown;
  },
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("whatsapp_webhook_logs")
      .insert({
        event_type: entry.eventType,
        phone: last10(entry.phone) || null,
        provider_message_id: entry.providerMessageId ?? null,
        processing_status: "received",
        payload: trimPayload(entry.payload),
      })
      .select("id")
      .maybeSingle();
    return data?.id ?? null;
  } catch (e) {
    console.error("whatsapp webhook log failed", e);
    return null;
  }
}

export async function finishWebhookLog(
  supabase: SupabaseClient,
  id: string | null,
  status: "processed" | "ignored" | "duplicate" | "failed",
  patch: {
    eventType?: string;
    phone?: string | null;
    providerMessageId?: string | null;
    error?: string | null;
  } = {},
): Promise<void> {
  if (!id) return;
  try {
    const update: Record<string, unknown> = {
      processing_status: status,
      processed_at: new Date().toISOString(),
    };
    if (patch.eventType) update.event_type = patch.eventType;
    if (patch.phone !== undefined) update.phone = last10(patch.phone) || null;
    if (patch.providerMessageId !== undefined) {
      update.provider_message_id = patch.providerMessageId;
    }
    if (patch.error !== undefined) update.error = patch.error;
    await supabase.from("whatsapp_webhook_logs").update(update).eq("id", id);
  } catch (e) {
    console.error("whatsapp webhook log update failed", e);
  }
}

/** Applies a delivery state to a message row, filling delivered/read stamps. */
export async function applyMessageStatus(
  supabase: SupabaseClient,
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed",
  errorMessage: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    error_message: status === "failed" ? errorMessage : null,
  };
  if (status === "delivered") patch.delivered_at = now;
  if (status === "read") {
    patch.read_at = now;
    patch.delivered_at = now;
  }
  await supabase.from("whatsapp_messages").update(patch).eq("id", messageId);
}
