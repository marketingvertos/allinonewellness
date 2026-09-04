import { useState } from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play } from "lucide-react";
import {
  useNotificationQueue,
  useRunNotificationQueue,
  useWhatsAppApiLogs,
  useWhatsAppMessages,
  useWhatsAppWebhookLogs,
} from "@/hooks/useWhatsApp";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string) {
  if (status === "failed") return "destructive" as const;
  if (status === "sent" || status === "delivered" || status === "read") return "default" as const;
  return "secondary" as const;
}

export default function WhatsAppLogs() {
  const [search, setSearch] = useState("");
  const { data: messages = [] } = useWhatsAppMessages({ search });
  const { data: apiLogs = [] } = useWhatsAppApiLogs();
  const { data: webhookLogs = [] } = useWhatsAppWebhookLogs();
  const { data: queue = [] } = useNotificationQueue();
  const run = useRunNotificationQueue();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">WhatsApp activity</h1>
          <p className="mt-1 text-muted-foreground">
            Every message, API call and provider callback in one place.
          </p>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Send queued now
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="api">API activity</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader className="gap-3">
              <CardTitle className="text-base">Message log</CardTitle>
              <Input
                placeholder="Search number or text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {!messages.length && (
                  <p className="p-4 text-sm text-muted-foreground">No messages yet.</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="border-b px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={statusTone(m.status)}>{m.status}</Badge>
                      <span className="font-medium">{m.direction === "outbound" ? "→" : "←"} {m.phone}</span>
                      <span className="text-xs text-muted-foreground">{m.source_module}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{when(m.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {m.message_content}
                    </p>
                    {m.error_message && (
                      <p className="mt-1 text-xs text-destructive">{m.error_message}</p>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification queue</CardTitle>
              <CardDescription>
                Queued items go out automatically every few minutes when automatic sending is on.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {!queue.length && (
                  <p className="p-4 text-sm text-muted-foreground">Nothing queued.</p>
                )}
                {queue.map((q: Record<string, unknown> & { id: string }) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
                    <Badge variant={statusTone(String(q.status))}>{String(q.status)}</Badge>
                    <span className="font-medium">
                      {(q.wellness_members as { full_name?: string } | null)?.full_name || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">{String(q.trigger_key)}</span>
                    {q.error_message ? (
                      <span className="text-xs text-destructive">{String(q.error_message)}</span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {when(q.created_at as string)}
                    </span>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {!apiLogs.length && (
                  <p className="p-4 text-sm text-muted-foreground">No API calls yet.</p>
                )}
                {apiLogs.map((l: Record<string, unknown> & { id: string }) => (
                  <div key={l.id} className="border-b px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={l.ok ? "default" : "destructive"}>
                        {l.ok ? "ok" : "failed"}
                      </Badge>
                      <span className="font-medium">{String(l.action)}</span>
                      <span className="text-xs text-muted-foreground">{String(l.function_name ?? "")}</span>
                      <span className="text-xs text-muted-foreground">{String(l.phone ?? "")}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {when(l.created_at as string)}
                      </span>
                    </div>
                    {l.error ? (
                      <p className="mt-1 text-xs text-destructive">{String(l.error)}</p>
                    ) : null}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {!webhookLogs.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    No callbacks received yet. Add the webhook URL from Settings in your provider panel.
                  </p>
                )}
                {webhookLogs.map((l: Record<string, unknown> & { id: string }) => (
                  <div key={l.id} className="border-b px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={l.processing_status === "failed" ? "destructive" : "secondary"}>
                        {String(l.processing_status)}
                      </Badge>
                      <span className="font-medium">{String(l.event_type)}</span>
                      <span className="text-xs text-muted-foreground">{String(l.phone ?? "")}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {when(l.created_at as string)}
                      </span>
                    </div>
                    {l.error ? (
                      <p className="mt-1 text-xs text-destructive">{String(l.error)}</p>
                    ) : null}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
