import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Archive,
  ArchiveRestore,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";
import {
  useArchiveConversation,
  useMarkConversationRead,
  useRetryWhatsAppMessage,
  useSendWhatsApp,
  useWhatsAppConversations,
  useWhatsAppMemberContext,
  useWhatsAppRealtime,
  useWhatsAppThread,
  type ConversationFilter,
  type WhatsAppMessage,
} from "@/hooks/useWhatsApp";
import TemplatePicker, { type TemplateSelection } from "@/components/whatsapp/TemplatePicker";
import { MemberSheetById } from "@/components/wellness/MemberSheetById";
import { cn } from "@/lib/utils";

const IST = "Asia/Kolkata";

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clockLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function istDayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
}

function dayHeading(key: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", {
    timeZone: IST,
  });
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_TEXT: Record<string, string> = {
  active_member: "Active member",
  renewal_due: "Renewal due",
  trial: "Trial",
  lead: "Lead",
  expired: "Membership expired",
  inactive: "Inactive",
};

function StatusTicks({ message }: { message: WhatsAppMessage }) {
  if (message.direction !== "outbound") return null;
  if (message.status === "sending") return <Clock className="h-3 w-3" />;
  if (message.status === "failed") return <TriangleAlert className="h-3 w-3" />;
  if (message.status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (message.status === "delivered") return <CheckCheck className="h-3 w-3" />;
  return <Check className="h-3 w-3" />;
}

export default function WhatsAppInbox() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useWhatsAppRealtime();

  const { data: conversations = [], isLoading, refetch, isFetching } =
    useWhatsAppConversations(search, filter);
  const { data: thread = [] } = useWhatsAppThread(selected);
  const markRead = useMarkConversationRead();
  const archive = useArchiveConversation();
  const send = useSendWhatsApp();
  const retry = useRetryWhatsAppMessage();

  const active = useMemo(
    () => conversations.find((c) => c.id === selected) || null,
    [conversations, selected],
  );
  const { data: memberContext } = useWhatsAppMemberContext(active?.member_id);

  useEffect(() => {
    if (selected && active?.unread_count) markRead.mutate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, active?.unread_count]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, selected]);

  const groups = useMemo(() => {
    const out: { key: string; items: WhatsAppMessage[] }[] = [];
    for (const m of thread) {
      const key = istDayKey(m.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(m);
      else out.push({ key, items: [m] });
    }
    return out;
  }, [thread]);

  const submit = () => {
    if (!active || !draft.trim() || send.isPending) return;
    const text = draft.trim();
    setDraft("");
    send.mutate({
      member_id: active.member_id,
      phone: active.phone,
      message_content: text,
      source_module: "manual",
      conversation_id: active.id,
    });
  };

  const sendTemplate = (selection: TemplateSelection) => {
    if (!active) return;
    send.mutate(
      {
        member_id: active.member_id,
        phone: active.phone,
        template_name: selection.template_name,
        template_language: selection.template_language,
        template_variables: selection.template_variables,
        message_content: null,
        source_module: "manual",
        conversation_id: active.id,
      },
      { onSuccess: () => setTemplatesOpen(false) },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">WhatsApp inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Replies from members and everything the centre has sent — updating live.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_260px]">
        {/* ---- conversation list ---- */}
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as ConversationFilter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px] lg:h-[560px]">
              {isLoading && (
                <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
              )}
              {!isLoading && !conversations.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  Nothing here yet. Chats appear as soon as messages are sent or received.
                </p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-start gap-2 border-b px-3 py-3 transition-colors hover:bg-muted/60",
                    selected === c.id && "bg-muted",
                  )}
                >
                  <button onClick={() => setSelected(c.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {c.wellness_members?.full_name || c.display_name || c.phone}
                      </span>
                      {c.unread_count > 0 && (
                        <Badge className="shrink-0">{c.unread_count}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">+91 {c.phone}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message_preview || "—"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground/80">
                        {timeLabel(c.last_message_at)}
                      </span>
                      {c.wellness_members?.status && (
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_TEXT[c.wellness_members.status] || c.wellness_members.status}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    title={c.archived_at ? "Restore" : "Archive"}
                    onClick={() =>
                      archive.mutate({ id: c.id, archived: !c.archived_at })}
                  >
                    {c.archived_at
                      ? <ArchiveRestore className="h-4 w-4" />
                      : <Archive className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ---- conversation ---- */}
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
            <ScrollArea className="h-[320px] rounded-md border p-3 lg:h-[420px]">
              {!active && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <MessageSquare className="mr-2 h-4 w-4" /> Pick a conversation to read the thread.
                </div>
              )}
              {active && !thread.length && (
                <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
              )}
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.key} className="space-y-3">
                    <div className="flex justify-center">
                      <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                        {dayHeading(g.key)}
                      </span>
                    </div>
                    {g.items.map((m) => (
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
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1 text-[10px]",
                            m.direction === "outbound"
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground",
                          )}
                        >
                          <span>{clockLabel(m.created_at)}</span>
                          <StatusTicks message={m} />
                          {m.status === "sending" && <span>Sending</span>}
                          {m.status === "failed" && <span>Message failed</span>}
                        </div>
                        {m.status === "failed" && (
                          <div className="mt-1 space-y-1">
                            {m.error_message && (
                              <p className="text-[10px] opacity-80">{m.error_message}</p>
                            )}
                            {!m.id.startsWith("temp-") && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-[11px]"
                                disabled={retry.isPending}
                                onClick={() => retry.mutate(m)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" /> Retry
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                rows={2}
                placeholder="Type a reply… (Enter to send, Shift + Enter for a new line)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                disabled={!active}
              />
              <div className="flex gap-2 sm:flex-col">
                <Button onClick={submit} disabled={!active || !draft.trim() || send.isPending}>
                  {send.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Send className="mr-2 h-4 w-4" />}
                  Send
                </Button>
                <Button
                  variant="outline"
                  disabled={!active}
                  onClick={() => setTemplatesOpen(true)}
                >
                  <FileText className="mr-2 h-4 w-4" /> Templates
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Free-text replies only reach members inside WhatsApp's 24-hour window. Outside it, use an approved template.
            </p>
          </CardContent>
        </Card>

        {/* ---- member panel ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Member details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!active && <p className="text-muted-foreground">Select a conversation.</p>}
            {active && !memberContext && (
              <p className="text-muted-foreground">
                This number is not linked to any member yet.
              </p>
            )}
            {memberContext && (
              <>
                <div>
                  <p className="font-medium">{memberContext.full_name}</p>
                  <p className="text-xs text-muted-foreground">{memberContext.mobile_number}</p>
                </div>
                <Badge variant="secondary">
                  {STATUS_TEXT[memberContext.status] || memberContext.status}
                </Badge>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="text-right">{memberContext.plan_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Servings left</dt>
                    <dd className="text-right">{memberContext.remaining_servings ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Batch</dt>
                    <dd className="text-right">{memberContext.batch_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Goal</dt>
                    <dd className="text-right">
                      {memberContext.goal ? memberContext.goal.replace(/_/g, " ") : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="text-right">
                      {new Date(memberContext.joining_date).toLocaleDateString("en-IN")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Last contact</dt>
                    <dd className="text-right">{timeLabel(active?.last_message_at ?? null)}</dd>
                  </div>
                </dl>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setProfileId(memberContext.id)}
                >
                  Open full profile
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TemplatePicker
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSend={sendTemplate}
        sending={send.isPending}
      />
      <MemberSheetById memberId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}
