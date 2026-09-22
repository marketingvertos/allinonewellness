// Direct Meta WhatsApp Cloud API sender.
// Token lives only in the META_ACCESS_TOKEN server secret and is never
// returned to the client or logged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v25.0";
const PHONE_NUMBER_ID = "892351043962383";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(
  message: string,
  code: string | number | null,
  details: string | null,
  httpStatus: number,
  responseStatus = 200,
) {
  return json(
    { success: false, http_status: httpStatus, error: { message, code, details } },
    responseStatus,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return fail("Method not allowed", "method_not_allowed", null, 405, 405);
  }

  try {
    // --- Auth: signed-in staff only -------------------------------------
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return fail("Please sign in first.", "unauthorized", null, 401, 401);
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return fail("Your session has expired. Sign in again.", "unauthorized", null, 401, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles || []).length) {
      return fail("Team access is required to send test messages.", "forbidden", null, 403, 403);
    }

    // --- Input ----------------------------------------------------------
    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail("The request body was not valid JSON.", "malformed_request", null, 400, 400);
    }

    const to = String(payload.to ?? "").replace(/[^\d]/g, "");
    if (!/^\d{10,15}$/.test(to)) {
      return fail(
        "Enter the recipient's number in international format with country code and no plus sign, e.g. 919815064617.",
        "invalid_recipient",
        null,
        400,
        400,
      );
    }
    const templateName = String(payload.template_name ?? "hello_world").trim() || "hello_world";
    const language = String(payload.language ?? "en_US").trim() || "en_US";

    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) {
      return fail(
        "The Meta access token is not configured on the server yet.",
        "missing_token",
        null,
        500,
        500,
      );
    }

    // --- Call Meta ------------------------------------------------------
    let response: Response;
    try {
      response = await fetch(GRAPH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: { name: templateName, language: { code: language } },
        }),
      });
    } catch (e) {
      console.error("Meta request failed (network)", e instanceof Error ? e.message : e);
      return fail(
        "Could not reach the WhatsApp service. Please try again.",
        "network_error",
        e instanceof Error ? e.message : null,
        502,
        200,
      );
    }

    const rawBody = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const metaError = (parsed?.error ?? {}) as Record<string, unknown>;
      const data = (metaError.error_data ?? {}) as Record<string, unknown>;
      console.error(`Meta API error [${response.status}]:`, rawBody.slice(0, 1000));
      return fail(
        String(metaError.message ?? `WhatsApp request failed with status ${response.status}`),
        (metaError.code as number | undefined) ?? response.status,
        String(
          data.details ??
            metaError.error_user_msg ??
            metaError.type ??
            rawBody.slice(0, 500) ??
            "",
        ) || null,
        response.status,
        200,
      );
    }

    const messages = (parsed?.messages ?? []) as Array<{ id?: string }>;
    const messageId = messages[0]?.id ?? null;
    if (!messageId) {
      return fail(
        "WhatsApp accepted the request but returned no message ID.",
        "no_message_id",
        rawBody.slice(0, 500),
        response.status,
        200,
      );
    }

    return json({
      success: true,
      message_id: messageId,
      http_status: response.status,
      to,
      template: templateName,
    });
  } catch (e) {
    console.error("whatsapp-cloud-send error", e instanceof Error ? e.message : e);
    return fail(
      "Something went wrong while sending the message.",
      "unexpected_error",
      e instanceof Error ? e.message : null,
      500,
      500,
    );
  }
});
