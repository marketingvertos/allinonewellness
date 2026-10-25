import { supabase } from "@/integrations/supabase/client";

export async function callBroadcast(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("whatsapp-broadcast", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.success === false) throw new Error(data.error || "Request failed");
  return data;
}
