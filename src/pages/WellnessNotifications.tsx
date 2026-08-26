import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  NotificationTemplate,
  useDeleteNotificationTemplate,
  useMarkNotificationSent,
  useNotificationLog,
  useNotificationTemplates,
  useSaveNotificationTemplate,
} from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/formatters";
import { Check, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";

const empty = {
  trigger_key: "",
  channel: "whatsapp",
  message_template: "",
  active: true,
};

const TRIGGERS = [
  "membership_activated",
  "membership_renewed",
  "serving_balance_5",
  "serving_balance_3",
  "serving_balance_1",
  "trial_ending",
  "birthday",
];

function renderMessage(template: string, name: string) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{name\}/gi, name);
}

export default function WellnessNotifications() {
  const { user } = useAuth();
  const { data: templates, isLoading } = useNotificationTemplates();
  const saveTemplate = useSaveNotificationTemplate();
  const deleteTemplate = useDeleteNotificationTemplate();
  const [logStatus, setLogStatus] = useState("queued");
  const { data: log, isLoading: logLoading } = useNotificationLog(logStatus);
  const markSent = useMarkNotificationSent();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form, setForm] = useState(empty);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setForm({
      trigger_key: t.trigger_key,
      channel: t.channel,
      message_template: t.message_template,
      active: t.active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    await saveTemplate.mutateAsync({
      id: editing?.id,
      trigger_key: form.trigger_key.trim(),
      channel: form.channel,
      message_template: form.message_template.trim(),
      active: form.active,
      ...(editing ? {} : { created_by: user.id }),
    });
    setOpen(false);
  };

  const templateFor = (key: string) => templates?.find((t) => t.trigger_key === key && t.active);

  return (
    <div className="space-y-6">
      <PageBanner
        title="Notifications"
        description="Message templates and the queue of member messages waiting to go out."
      >
        <Button className="w-full sm:w-auto" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New template
        </Button>
      </PageBanner>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4 pt-4">
          <Select value={logStatus} onValueChange={setLogStatus}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {logLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : log?.length ? (
            <div className="space-y-2">
              {log.map((entry) => {
                const name = entry.wellness_members?.full_name ?? "Member";
                const tpl = templateFor(entry.trigger_key);
                const message =
                  entry.message ??
                  (tpl ? renderMessage(tpl.message_template, name) : `Update about your wellness plan, ${name}.`);
                const mobile = (entry.wellness_members?.mobile_number ?? "").replace(/\D/g, "").slice(-10);
                return (
                  <Card key={entry.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="truncate">{name}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.trigger_key.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Queued {formatDateTime(entry.created_at)} · {entry.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {mobile && (
                          <Button size="sm" variant="secondary" asChild>
                            <a
                              href={`https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp
                            </a>
                          </Button>
                        )}
                        {entry.status !== "sent" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markSent.mutate({ id: entry.id, status: "sent" })}
                          >
                            <Check className="mr-2 h-3.5 w-3.5" /> Mark sent
                          </Button>
                        )}
                        {entry.status === "queued" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markSent.mutate({ id: entry.id, status: "failed" })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="py-16 text-center text-muted-foreground">Nothing in this view.</p>
          )}
        </TabsContent>

        <TabsContent value="templates" className="pt-4">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : templates?.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className={t.active ? "" : "opacity-60"}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-base capitalize">{t.trigger_key.replace(/_/g, " ")}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {t.channel}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>{t.message_template}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteTemplate.mutate(t.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-muted-foreground">No templates yet.</p>
          )}
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit template" : "New template"}
        description={<>Use {"{{name}}"} to insert the member's name.</>}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!form.trigger_key || !form.message_template.trim() || saveTemplate.isPending}
            >
              Save template
            </Button>
          </>
        }
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={form.trigger_key} onValueChange={(v) => setForm({ ...form, trigger_key: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-msg">Message</Label>
              <Textarea
                id="n-msg"
                rows={4}
                value={form.message_template}
                onChange={(e) => setForm({ ...form, message_template: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive templates stop queueing new messages.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          </ResponsiveDialog>
    </div>
  );
}
