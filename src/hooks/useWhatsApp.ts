import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppSettingsValues {
  whatsapp_provider: string;
  whatsapp_api_url: string;
  whatsapp_api_key: string;
  whatsapp_vendor_uid: string;
  whatsapp_phone_number_id: string;
  whatsapp_verify_token: string;
  whatsapp_app_secret: string;
  whatsapp_default_language: string;
  whatsapp_automation_enabled: string;
}

export const WHATSAPP_KEYS: (keyof WhatsAppSettingsValues)[] = [
  "whatsapp_provider",
  "whatsapp_api_url",
  "whatsapp_api_key",
  "whatsapp_vendor_uid",
  "whatsapp_phone_number_id",
  "whatsapp_verify_token",
  "whatsapp_app_secret",
  "whatsapp_default_language",
  "whatsapp_automation_enabled",
];

export interface WhatsAppConversation {
  id: string;
  phone: string;
  member_id: string | null;
  display_name: string | null;
  status: string;
  unread_count: number;
  last_direction: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  archived_at: string | null;
  wellness_members?: { id: string; full_name: string; status: string } | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string | null;
  member_id: string | null;
  phone: string | null;
  direction: "inbound" | "outbound";
  message_type: string;
  source_module: string;
  template_name: string | null;
  message_content: string | null;
  status: string;
  error_message: string | null;
  provider_message_id: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

function errText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

/** Admin-only WhatsApp credentials stored in integration_credentials. */
export function useWhatsAppSettings() {
  return useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: async (): Promise<Partial<WhatsAppSettingsValues>> => {
      const { data, error } = await supabase
        .from("integration_credentials")
        .select("key, value")
        .in("key", WHATSAPP_KEYS as string[]);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const row of data || []) out[row.key] = row.value ?? "";
      return out as Partial<WhatsAppSettingsValues>;
    },
  });
}

export function useSaveWhatsAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<WhatsAppSettingsValues>) => {
      const { data: auth } = await supabase.auth.getUser();
      const rows = Object.entries(values).map(([key, value]) => ({
        key,
        value: value ?? "",
        updated_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("integration_credentials")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      toast.success("WhatsApp settings saved");
    },
    onError: (e) => toast.error(errText(e)),
  });
}

export interface TestConnectionInput {
  phone: string;
  message_content?: string | null;
  template_name?: string | null;
  template_language?: string | null;
  template_variables?: string[];
}

export interface TestConnectionResult {
  success: boolean;
  not_configured?: boolean;
  provider?: string;
  api_url?: string;
  http_status?: number | null;
  message_id?: string | null;
  provider_message_id?: string | null;
  latency_ms?: number;
  error?: string | null;
  details?: string | null;
}

/** Edge functions may answer with a non-2xx status; still read the JSON body. */
async function readFunctionError(error: unknown): Promise<TestConnectionResult | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === "object") {
        return { success: false, ...(body as Record<string, unknown>) } as TestConnectionResult;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useTestWhatsAppConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TestConnectionInput): Promise<TestConnectionResult> => {
      const { data, error } = await supabase.functions.invoke("whatsapp-test-connection", {
        body: input,
      });
      if (error) {
        const parsed = await readFunctionError(error);
        if (parsed) return parsed;
        return { success: false, error: errText(error) };
      }
      return data as TestConnectionResult;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-api-logs"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onSuccess: (data) => {
      if (data.success) toast.success("Test message sent successfully");
      else toast.error(data.error || "The provider rejected the test message");
    },
    onError: (e) => toast.error(errText(e)),
  });
}

export type ConversationFilter = "all" | "unread" | "archived";

export function useWhatsAppConversations(search = "", filter: ConversationFilter = "all") {
  return useQuery({
    queryKey: ["whatsapp-conversations", search, filter],
    queryFn: async (): Promise<WhatsAppConversation[]> => {
      let q = supabase
        .from("whatsapp_conversations")
        .select("*, wellness_members(id, full_name, status)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      const term = search.trim();
      if (term) q = q.or(`phone.ilike.%${term}%,display_name.ilike.%${term}%`);
      if (filter === "archived") q = q.not("archived_at", "is", null);
      else q = q.is("archived_at", null);
      if (filter === "unread") q = q.gt("unread_count", 0);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WhatsAppConversation[];
    },
  });
}

export function useWhatsAppThread(conversationId: string | null) {
  return useQuery({
    queryKey: ["whatsapp-thread", conversationId],
    queryFn: async (): Promise<WhatsAppMessage[]> => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as WhatsAppMessage[];
    },
    enabled: !!conversationId,
  });
}

/** Live updates for messages and conversations — replaces polling. */
export function useWhatsAppRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
          qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] }),
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return archived;
    },
    onSuccess: (archived) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast.success(archived ? "Conversation archived" : "Conversation restored");
    },
    onError: (e) => toast.error(errText(e)),
  });
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string | null;
  body: string;
  variable_count: number;
  has_media_header: boolean;
}

/** Approved templates read live from the connected WhatsApp Business account. */
export function useWhatsAppTemplates(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async (): Promise<WhatsAppTemplate[]> => {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: {},
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; templates?: WhatsAppTemplate[] };
      if (!result.success) throw new Error(result.error || "Could not read templates");
      return result.templates || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export interface SendWhatsAppInput {
  member_id?: string | null;
  phone?: string | null;
  message_content?: string | null;
  template_name?: string | null;
  template_language?: string | null;
  template_variables?: string[];
  source_module?: string;
  /** Used only to show the message immediately in the open thread. */
  conversation_id?: string | null;
}

function tempMessage(input: SendWhatsAppInput, tempId: string): WhatsAppMessage {
  return {
    id: tempId,
    conversation_id: input.conversation_id ?? null,
    member_id: input.member_id ?? null,
    phone: input.phone ?? null,
    direction: "outbound",
    message_type: input.template_name ? "template" : "text",
    source_module: input.source_module || "manual",
    template_name: input.template_name ?? null,
    message_content: input.message_content ??
      (input.template_name ? `[${input.template_name}]` : ""),
    status: "sending",
    error_message: null,
    provider_message_id: null,
    created_at: new Date().toISOString(),
    delivered_at: null,
    read_at: null,
  };
}

export function useSendWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendWhatsAppInput) => {
      const { conversation_id: _ignored, ...payload } = input;
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: payload,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || "WhatsApp send failed");
      return result;
    },
    onMutate: async (input) => {
      const key = ["whatsapp-thread", input.conversation_id];
      if (!input.conversation_id) return { key: null, tempId: null };
      await qc.cancelQueries({ queryKey: key });
      const tempId = `temp-${crypto.randomUUID()}`;
      qc.setQueryData<WhatsAppMessage[]>(key, (old) => [
        ...(old || []),
        tempMessage(input, tempId),
      ]);
      return { key, tempId };
    },
    onError: (e, _input, ctx) => {
      if (ctx?.key && ctx.tempId) {
        qc.setQueryData<WhatsAppMessage[]>(ctx.key, (old) =>
          (old || []).map((m) =>
            m.id === ctx.tempId
              ? { ...m, status: "failed", error_message: errText(e) }
              : m
          ));
      }
      toast.error(errText(e));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    },
  });
}

export interface WhatsAppMemberContext {
  id: string;
  full_name: string;
  mobile_number: string;
  status: string;
  goal: string | null;
  joining_date: string;
  batch_name: string | null;
  plan_name: string | null;
  remaining_servings: number | null;
  end_date: string | null;
}

/** Wellness details shown beside the conversation. */
export function useWhatsAppMemberContext(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["whatsapp-member-context", memberId],
    queryFn: async (): Promise<WhatsAppMemberContext | null> => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select(
          "id, full_name, mobile_number, status, goal, joining_date, wellness_batches(name)",
        )
        .eq("id", memberId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: membership } = await supabase
        .from("wellness_memberships")
        .select("remaining_servings, end_date, wellness_plans(name)")
        .eq("member_id", memberId!)
        .in("status", ["active", "expiring_soon"])
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as unknown as {
        id: string;
        full_name: string;
        mobile_number: string;
        status: string;
        goal: string | null;
        joining_date: string;
        wellness_batches?: { name: string } | null;
      };
      const m = membership as unknown as {
        remaining_servings: number;
        end_date: string;
        wellness_plans?: { name: string } | null;
      } | null;

      return {
        id: row.id,
        full_name: row.full_name,
        mobile_number: row.mobile_number,
        status: row.status,
        goal: row.goal,
        joining_date: row.joining_date,
        batch_name: row.wellness_batches?.name ?? null,
        plan_name: m?.wellness_plans?.name ?? null,
        remaining_servings: m?.remaining_servings ?? null,
        end_date: m?.end_date ?? null,
      };
    },
    enabled: !!memberId,
  });
}

export function useRetryWhatsAppMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: WhatsAppMessage) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          member_id: message.member_id,
          phone: message.phone,
          message_content: message.message_content,
          template_name: message.template_name,
          source_module: "manual",
        },
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || "WhatsApp send failed");
      return result;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-api-logs"] });
    },
    onSuccess: () => toast.success("Message resent"),
    onError: (e) => toast.error(errText(e)),
  });
}

export function useWhatsAppMessages(filter: { status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ["whatsapp-messages", filter],
    queryFn: async (): Promise<WhatsAppMessage[]> => {
      let q = supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
      const term = filter.search?.trim();
      if (term) q = q.or(`phone.ilike.%${term}%,message_content.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as WhatsAppMessage[];
    },
  });
}

export function useWhatsAppApiLogs() {
  return useQuery({
    queryKey: ["whatsapp-api-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_api_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useWhatsAppWebhookLogs() {
  return useQuery({
    queryKey: ["whatsapp-webhook-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

/** Queued / failed wellness notifications waiting to go out on WhatsApp. */
export function useNotificationQueue() {
  return useQuery({
    queryKey: ["whatsapp-notification-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_notification_log")
        .select("*, wellness_members(id, full_name, mobile_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRunNotificationQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "whatsapp-notification-runner",
        { body: {} },
      );
      if (error) throw error;
      return data as { sent?: number; failed?: number; skipped?: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-notification-queue"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      if (data.skipped === "not_configured") {
        toast.error("Add your WhatsApp credentials in Settings first");
      } else if (data.skipped === "automation_disabled") {
        toast.error("Automatic sending is switched off in Settings");
      } else {
        toast.success(`Sent ${data.sent ?? 0}, failed ${data.failed ?? 0}`);
      }
    },
    onError: (e) => toast.error(errText(e)),
  });
}
