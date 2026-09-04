import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, RefreshCw, Search, Send } from "lucide-react";
import {
  useMarkConversationRead,
  useSendWhatsApp,
  useWhatsAppConversations,
  useWhatsAppThread,
} from "@/hooks/useWhatsApp";
import { cn } from "@/lib/utils";

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WhatsAppInbox() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: conversations = [], isLoading, refetch, isFetching } =
    useWhatsAppConversations(search);
  const { data: thread = [] } = useWhatsAppThread(selected);
  const markRead = useMarkConversationRead();
  const send = useSendWhatsApp();

  const active = useMemo(
    () => conversations.find((c) => c.id === selected) || null,
    [conversations, selected],
  );

  useEffect(() => {
    if (selected && active?.unread_count) markRead.mutate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, active?.unread_count]);

  const submit = () => {
    if (!active || !draft.trim()) return;
    send.mutate(
      {
        member_id: active.member_id,
        phone: active.phone,
        message_content: draft.trim(),
        source_module: "manual",
      },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">WhatsApp inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Replies from members and everything the centre has sent.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px] lg:h-[560px]">
              {isLoading && (
                <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
              )}
              {!isLoading && !conversations.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  No conversations yet. They appear as soon as messages are sent or received.
                </p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    selected === c.id && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {c.wellness_members?.full_name || c.display_name || c.phone}
                    </span>
                    {c.unread_count > 0 && (
                      <Badge className="shrink-0">{c.unread_count}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.last_message_preview || c.phone}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {timeLabel(c.last_message_at)}
                  </p>
                </button>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {active
                ? active.wellness_members?.full_name || active.display_name || active.phone
                : "Select a conversation"}
            </CardTitle>
            {active && <p className="text-xs text-muted-foreground">+91 {active.phone}</p>}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <ScrollArea className="h-[320px] rounded-md border p-3 lg:h-[440px]">
              {!active && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <MessageSquare className="mr-2 h-4 w-4" /> Pick a conversation to read the thread.
                </div>
              )}
              {active && !thread.length && (
                <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
              )}
              <div className="space-y-3">
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      m.direction === "outbound"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message_content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.direction === "outbound"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {timeLabel(m.created_at)} · {m.status}
                      {m.error_message ? ` · ${m.error_message}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                rows={2}
                placeholder="Type a reply…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!active}
              />
              <Button onClick={submit} disabled={!active || !draft.trim() || send.isPending}>
                {send.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Free-text replies only reach members inside WhatsApp's 24-hour window. Outside it, use an approved template.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
