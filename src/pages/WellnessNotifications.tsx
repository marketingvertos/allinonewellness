import { useState } from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { useAuth } from "@/contexts/AuthContext";
import {
  NotificationTemplate,
  useDeleteNotificationTemplate,
  useMarkNotificationSent,
  useNotificationLog,
  useNotificationTemplates,
  useSaveNotificationTemplate,
} from "@/hooks/useWellness";
import { useWhatsAppTemplates } from "@/hooks/useWhatsApp";
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
  template_name: "",
  template_language: "",
  variables: [] as string[],
};

const TRIGGERS = [
  "member_created",
  "login_credentials",
  "trial_started",
  "trial_ending",
  "membership_activated",
  "membership_renewed",
  "plan_switched",
  "checkin_approved",
  "checkin_rejected",
  "servings_issued",
  "serving_balance",
  "serving_balance_5",
  "serving_balance_3",
  "serving_balance_1",
  "serving_balance_0",
  "renewal_due",
  "renewal_reminder",
  "membership_expired",
  "payment_received",
  "milestone_achieved",
  "birthday",
  "anniversary",
];

/** Member details the automatic message can insert into a template variable. */
const MEMBER_FIELDS = [
  { value: "name", label: "First name" },
  { value: "full_name", label: "Full name" },
  { value: "remaining", label: "Servings left" },
  { value: "code", label: "Membership code" },
  { value: "end_date", label: "Plan end date" },
  { value: "weight", label: "Latest weight" },
  { value: "start_weight", label: "Weight at joining" },
  { value: "weight_change", label: "Total weight change" },
  { value: "used_today", label: "Servings used today" },
  { value: "date", label: "Today's date" },
];

function renderMessage(template: string, name: string) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{name\}/gi, name);
}

export default function WellnessNotifications() {
  const [tab, setTab] = useTabParam(["queue", "templates"]);
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
      template_name: t.template_name ?? "",
      template_language: t.template_language ?? "",
      variables: t.variables ?? [],
    });
    setOpen(true);
  };

  const approved = useWhatsAppTemplates(open && form.channel === "whatsapp");
  const chosen = approved.data?.find((t) => t.name === form.template_name) || null;

  const pickApprovedTemplate = (name: string) => {
    if (name === "__none__") {
      setForm((f) => ({ ...f, template_name: "", template_language: "", variables: [] }));
      return;
    }
    const tpl = approved.data?.find((t) => t.name === name);
    setForm((f) => ({
      ...f,
      template_name: name,
      template_language: tpl?.language ?? "en",
      variables: Array.from({ length: tpl?.variable_count ?? 0 }, (_, i) => f.variables[i] ?? "name"),
    }));
  };

  const setVariable = (index: number, value: string) => {
    setForm((f) => {
      const next = [...f.variables];
      next[index] = value;
      return { ...f, variables: next };
    });
  };

  const submit = async () => {
    if (!user) return;
    await saveTemplate.mutateAsync({
      id: editing?.id,
      trigger_key: form.trigger_key.trim(),
      channel: form.channel,
      message_template: form.message_template.trim(),
      active: form.active,
      template_name: form.template_name || null,
      template_language: form.template_name ? form.template_language || "en" : null,
      variables: form.template_name ? form.variables : [],
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

      <Tabs value={tab} onValueChange={setTab}>
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
                    <p className="text-xs">
                      {t.template_name
                        ? `Approved template: ${t.template_name} (${t.template_language || "en"})`
                        : "Free text only — works inside the 24-hour reply window."}
                    </p>
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

            {form.channel === "whatsapp" && (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Approved WhatsApp template</p>
                  <p className="text-xs text-muted-foreground">
                    Needed to reach members outside WhatsApp's 24-hour reply window. The free text
                    above is used inside that window.
                  </p>
                </div>
                {approved.isLoading && (
                  <p className="text-xs text-muted-foreground">Reading templates…</p>
                )}
                {approved.error && (
                  <p className="text-xs text-destructive">{(approved.error as Error).message}</p>
                )}
                <Select
                  value={form.template_name || "__none__"}
                  onValueChange={pickApprovedTemplate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Free text only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Free text only</SelectItem>
                    {(approved.data || []).map((t) => (
                      <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                        {t.name} ({t.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {chosen && (
                  <>
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                      {chosen.body}
                    </p>
                    {Array.from({ length: chosen.variable_count }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-12 text-xs text-muted-foreground">
                          {`{{${i + 1}}}`}
                        </span>
                        <Select
                          value={form.variables[i] || "name"}
                          onValueChange={(v) => setVariable(i, v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
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
