// Shared helpers for the WhatsApp Cloud API integration.
// Credentials are stored in the admin-only `integration_credentials` table so
// they can be managed from Settings, with env secrets as a fallback.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type WhatsAppProvider = "meta" | "wachat";

export interface WhatsAppConfig {
  /** Explicit provider choice made in Settings. */
  provider: WhatsAppProvider;
  apiUrl: string;
  apiKey: string;
  phoneNumberId: string;
  vendorUid: string;
  verifyToken: string;
  appSecret: string;
  defaultLanguage: string;
  /**
   * Master switch for CRM-triggered WhatsApp automation (auto-reply bot,
   * nurture follow-ups, hot-lead pings). Disabled unless explicitly turned on
   * in Settings. Admin-initiated sends (fee receipts, manual replies) ignore it.
   */
  automationEnabled: boolean;
}

export const META_DEFAULT_API_URL = "https://graph.facebook.com/v21.0";
export const WACHAT_DEFAULT_API_URL = "https://panel.wachatsender.com/api/v1";

export async function loadWhatsAppConfig(
  supabase: SupabaseClient,
): Promise<WhatsAppConfig> {
  const { data } = await supabase
    .from("integration_credentials")
    .select("key, value")
    .like("key", "whatsapp_%");

  const row: Record<string, string> = {};
  for (const r of data || []) {
    if (r.value) row[r.key] = String(r.value).trim();
  }

  const pick = (dbKey: string, envKey: string) =>
    row[dbKey] || Deno.env.get(envKey) || "";

  const apiUrlRaw = pick("whatsapp_api_url", "WHATSAPP_API_URL").replace(/\/+$/, "");
  const vendorUid = pick("whatsapp_vendor_uid", "WACHATSENDER_VENDOR_UID");
  const phoneNumberId = pick(
    "whatsapp_phone_number_id",
    "WHATSAPP_PHONE_NUMBER_ID",
  );

  // Explicit choice wins. Only fall back to inference for setups saved before
  // the provider selector existed.
  const stored = String(
    pick("whatsapp_provider", "WHATSAPP_PROVIDER"),
  ).toLowerCase();
  let provider: WhatsAppProvider;
  if (stored === "meta" || stored === "wachat") {
    provider = stored;
  } else if (/wachatsender/i.test(apiUrlRaw)) {
    provider = "wachat";
  } else if (/graph\.facebook\.com/i.test(apiUrlRaw) || phoneNumberId) {
    provider = "meta";
  } else {
    provider = vendorUid ? "wachat" : "meta";
  }

  const apiUrl = apiUrlRaw ||
    (provider === "wachat" ? WACHAT_DEFAULT_API_URL : META_DEFAULT_API_URL);

  return {
    provider,
    apiUrl,
    apiKey: pick("whatsapp_api_key", "WHATSAPP_API_KEY"),
    phoneNumberId,
    vendorUid,
    verifyToken: pick("whatsapp_verify_token", "WHATSAPP_VERIFY_TOKEN"),
    appSecret: pick("whatsapp_app_secret", "WHATSAPP_APP_SECRET"),
    defaultLanguage: row["whatsapp_default_language"] || "en",
    automationEnabled:
      String(row["whatsapp_automation_enabled"] || "").toLowerCase() === "true",
  };
}

/** Checks the saved credentials make sense for the chosen provider. */
export function validateConfig(
  cfg: WhatsAppConfig,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!cfg.apiKey) problems.push("Access token is missing");

  if (cfg.provider === "wachat") {
    if (!cfg.vendorUid) problems.push("Vendor UID is missing");
    if (/graph\.facebook\.com/i.test(cfg.apiUrl)) {
      problems.push(
        "The API base URL points at Meta (graph.facebook.com) but the provider is set to WachatSender",
      );
    }
  } else {
    if (!cfg.phoneNumberId) problems.push("Phone number ID is missing");
    if (/wachatsender/i.test(cfg.apiUrl)) {
      problems.push(
        "The API base URL points at WachatSender but the provider is set to Meta Cloud API",
      );
    }
  }
  return { ok: problems.length === 0, problems };
}


/** Last 10 digits of a phone number — used to match numbers across formats. */
export function last10(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-10);
}

/** Convert an Indian phone number to E.164 digits (91XXXXXXXXXX). */
export function toE164(phone: string | null | undefined): string {
  const ten = last10(phone);
  if (ten.length !== 10) return "";
  return `91${ten}`;
}

/** Delivery status ranking — statuses may only move forward. */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
  received: 4,
};

export function canUpgradeStatus(current: string, next: string): boolean {
  const cur = STATUS_RANK[current] ?? 0;
  const nxt = STATUS_RANK[next] ?? 0;
  if (current === "failed") return false;
  return nxt > cur;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// WachatSender (BSP) request builders
// Endpoint: {API_BASE_URL}/{VENDOR_UID}/contact/send-message?token={ACCESS_TOKEN}
// ---------------------------------------------------------------------------

export interface SendInput {
  to: string; // E.164 digits, no +
  templateName?: string | null;
  templateLanguage?: string | null;
  vars?: string[];
  text?: string | null;
  /** Optional document/media attachment (public or signed URL). */
  mediaUrl?: string | null;
  mediaFileName?: string | null;
}

export function isWachat(cfg: WhatsAppConfig): boolean {
  return Boolean(cfg.vendorUid) || /wachatsender/i.test(cfg.apiUrl);
}

/** Builds the provider URL + JSON body for a send. */
export function buildSendRequest(
  cfg: WhatsAppConfig,
  input: SendInput,
): { url: string; body: Record<string, unknown>; headers: Record<string, string> } {
  const vars = input.vars || [];

  if (isWachat(cfg)) {
    const token = encodeURIComponent(cfg.apiKey);
    const headers = { "Content-Type": "application/json", Accept: "application/json" };

    // Approved templates use a dedicated endpoint on WachatSender; the
    // free-form endpoint rejects them ("The message body field is required").
    if (input.templateName) {
      const url =
        `${cfg.apiUrl}/${cfg.vendorUid}/contact/send-template-message?token=${token}`;
      const body: Record<string, unknown> = {
        phone_number: input.to,
        template_name: input.templateName,
        template_language: input.templateLanguage || cfg.defaultLanguage || "en",
      };
      vars.forEach((v, i) => {
        body[`field_${i + 1}`] = v ?? "";
      });
      if (input.mediaUrl) {
        // Document header of the approved template. Field aliases differ per
        // panel version, so send the common ones.
        body.header_document = input.mediaUrl;
        body.header_document_link = input.mediaUrl;
        body.document_url = input.mediaUrl;
        body.media_url = input.mediaUrl;
        if (input.mediaFileName) {
          body.header_document_name = input.mediaFileName;
          body.file_name = input.mediaFileName;
          body.filename = input.mediaFileName;
        }
      }
      return { url, body, headers };
    }

    const url = `${cfg.apiUrl}/${cfg.vendorUid}/contact/send-message?token=${token}`;
    const body: Record<string, unknown> = { phone_number: input.to };
    // Free-form (24h service window) message.
    body.message_body = input.text ?? "";
    body.message = input.text ?? "";
    body.body = input.text ?? "";
    if (input.mediaUrl) {
      body.type = "document";
      body.message_type = "document";
      body.media_type = "document";
      body.media_url = input.mediaUrl;
      body.file_url = input.mediaUrl;
      body.document_url = input.mediaUrl;
      if (input.mediaFileName) {
        body.file_name = input.mediaFileName;
        body.filename = input.mediaFileName;
      }
      body.caption = input.text ?? "";
    }
    return { url, body, headers };
  }


  // Meta Cloud API
  const url = `${cfg.apiUrl}/${cfg.phoneNumberId}/messages`;
  const body = input.templateName
    ? {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.templateLanguage || cfg.defaultLanguage || "en" },
        components: [
          // Document header (used for fee receipts and other attachments).
          ...(input.mediaUrl
            ? [{
              type: "header",
              parameters: [{
                type: "document",
                document: {
                  link: input.mediaUrl,
                  filename: input.mediaFileName || "document.pdf",
                },
              }],
            }]
            : []),
          ...(vars.length
            ? [{
              type: "body",
              parameters: vars.map((text) => ({ type: "text", text })),
            }]
            : []),
        ],
      },
    }
    : input.mediaUrl
    ? {
      messaging_product: "whatsapp",
      to: input.to,
      type: "document",
      document: {
        link: input.mediaUrl,
        filename: input.mediaFileName || "receipt.pdf",
        caption: input.text ?? "",
      },
    }
    : {
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { preview_url: false, body: input.text ?? "" },
    };

  return {
    url,
    body,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
  };
}

export interface SendOutcome {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
  errorCode: string | number | null;
  errorDetails: string | null;
}

/** Normalises provider responses (WachatSender or Meta) into one shape. */
export function parseSendResponse(
  cfg: WhatsAppConfig,
  httpOk: boolean,
  httpStatus: number,
  result: any,
): SendOutcome {
  if (isWachat(cfg)) {
    const status = String(result?.status ?? "").toLowerCase();
    const failed = !httpOk || status === "error" || status === "false" ||
      result?.success === false;
    const messageText = typeof result?.message === "string" ? result.message : null;
    if (failed) {
      return {
        ok: false,
        providerMessageId: null,
        error: messageText || result?.error ||
          `WachatSender API returned ${httpStatus}`,
        errorCode: result?.code ?? httpStatus ?? null,
        errorDetails: result?.data ? JSON.stringify(result.data).slice(0, 500) : null,
      };
    }
    const d = result?.data ?? {};
    return {
      ok: true,
      providerMessageId: d?.wamid ?? d?.message?.wamid ?? d?.id ?? null,
      error: null,
      errorCode: null,
      errorDetails: null,
    };
  }

  if (!httpOk) {
    return {
      ok: false,
      providerMessageId: null,
      error: result?.error?.message || `WhatsApp API returned ${httpStatus}`,
      errorCode: result?.error?.code ?? null,
      errorDetails: result?.error?.error_data?.details ?? null,
    };
  }
  return {
    ok: true,
    providerMessageId: result?.messages?.[0]?.id ?? null,
    error: null,
    errorCode: null,
    errorDetails: null,
  };
}
