import { useMemo, useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAllWhatsAppTemplates,
  useCreateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  type WhatsAppTemplateFull,
} from "@/hooks/useWhatsApp";
import { Copy, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi", label: "Hindi" },
];

const CATEGORIES = [
  { value: "UTILITY", label: "Utility — reminders, updates, confirmations" },
  { value: "MARKETING", label: "Marketing — offers and promotions" },
  { value: "AUTHENTICATION", label: "Authentication — one-time codes" },
];

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  REJECTED: "bg-destructive/15 text-destructive",
  PAUSED: "bg-muted text-muted-foreground",
};

const emptyForm = {
  name: "",
  language: "en",
  category: "UTILITY",
  header: "",
  body: "",
  footer: "",
  buttons: "",
};

type FormState = typeof emptyForm;

function variableNumbers(text: string): number[] {
  const found = (text.match(/\{\{\s*(\d+)\s*\}\}/g) || [])
    .map((m) => Number(m.replace(/\D/g, "")));
  return [...new Set(found)].sort((a, b) => a - b);
}

function fill(text: string, samples: Record<number, string>): string {
  return text.replace(
    /\{\{\s*(\d+)\s*\}\}/g,
    (_m, n: string) => samples[Number(n)] || `{{${n}}}`,
  );
}

export default function WhatsAppTemplates() {
  const { data: templates, isLoading, error, refetch, isFetching } = useAllWhatsAppTemplates();
  const create = useCreateWhatsAppTemplate();
  const remove = useDeleteWhatsAppTemplate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [samples, setSamples] = useState<Record<number, string>>({});
  const [toDelete, setToDelete] = useState<WhatsAppTemplateFull | null>(null);

  const vars = useMemo(
    () => variableNumbers(`${form.header} ${form.body}`),
    [form.header, form.body],
  );
  const bodyVars = useMemo(() => variableNumbers(form.body), [form.body]);
  const headerVars = useMemo(() => variableNumbers(form.header), [form.header]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (templates || []).filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!term) return true;
      return t.name.includes(term) || t.body.toLowerCase().includes(term);
    });
  }, [templates, search, status]);

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!form.name.trim()) list.push("Give the template a name.");
    if (!form.body.trim()) list.push("Write the message body.");
    for (const n of vars) {
      if (!samples[n]?.trim()) list.push(`Add a sample value for {{${n}}}.`);
    }
    const words = form.body.trim().split(/\s+/).filter(Boolean).length;
    if (form.body.trim() && words < vars.length * 4) {
      list.push("Write a fuller sentence — Meta rejects bodies that are mostly variables.");
    }
    if (/^\s*\{\{\s*\d+\s*\}\}/.test(form.body) || /\{\{\s*\d+\s*\}\}\s*$/.test(form.body)) {
      list.push("A variable cannot sit at the very start or end of the body.");
    }
    return list;
  }, [form, vars, samples]);

  const openNew = () => {
    setForm(emptyForm);
    setSamples({});
    setOpen(true);
  };

  const duplicate = (t: WhatsAppTemplateFull) => {
    setForm({
      name: `${t.name}_v2`.slice(0, 60),
      language: t.language,
      category: t.category || "UTILITY",
      header: t.header,
      body: t.body,
      footer: t.footer,
      buttons: "",
    });
    setSamples({});
    setOpen(true);
  };

  const submit = async () => {
    const components: Record<string, unknown>[] = [];
    if (form.header.trim()) {
      const header: Record<string, unknown> = {
        type: "HEADER",
        format: "TEXT",
        text: form.header.trim(),
      };
      if (headerVars.length) {
        header.example = { header_text: headerVars.map((n) => samples[n] || "") };
      }
      components.push(header);
    }
    const body: Record<string, unknown> = { type: "BODY", text: form.body.trim() };
    if (bodyVars.length) {
      body.example = { body_text: [bodyVars.map((n) => samples[n] || "")] };
    }
    components.push(body);
    if (form.footer.trim()) {
      components.push({ type: "FOOTER", text: form.footer.trim() });
    }
    const buttonLabels = form.buttons.split(",").map((b) => b.trim()).filter(Boolean).slice(0, 3);
    if (buttonLabels.length) {
      components.push({
        type: "BUTTONS",
        buttons: buttonLabels.map((text) => ({ type: "QUICK_REPLY", text })),
      });
    }

    await create.mutateAsync({
      name: form.name.trim(),
      language: form.language,
      category: form.category,
      components,
    });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageBanner
        title="WhatsApp templates"
        description="Write templates here and send them to Meta for approval. Approved ones can be used for automatic member messages."
      >
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New template
          </Button>
        </div>
      </PageBanner>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((t) => (
            <Card key={`${t.name}-${t.language}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t.language} · {t.category || "—"}
                  </p>
                </div>
                <Badge className={cn("shrink-0 border-0", STATUS_STYLE[t.status] || "")}>
                  {t.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {t.header && <p className="font-medium">{t.header}</p>}
                <p className="whitespace-pre-wrap text-muted-foreground">{t.body}</p>
                {t.footer && <p className="text-xs text-muted-foreground/80">{t.footer}</p>}
                {t.rejected_reason && (
                  <p className="text-xs text-destructive">
                    Meta's reason: {t.rejected_reason.replace(/_/g, " ").toLowerCase()}
                  </p>
                )}
                {t.variable_count > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t.variable_count} variable{t.variable_count > 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => duplicate(t)}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setToDelete(t)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">
          No templates match this view.
        </p>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="New template"
        description="Meta reviews every template before it can be sent. Utility templates are approved fastest."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={problems.length > 0 || create.isPending}>
              {create.isPending ? "Sending…" : "Send to Meta"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.name}
                placeholder="checkin_confirmation"
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  })}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and underscores only.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={form.language}
                onValueChange={(v) => setForm({ ...form, language: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-header">Header (optional)</Label>
            <Input
              id="t-header"
              value={form.header}
              placeholder="All In One Wellness"
              onChange={(e) => setForm({ ...form, header: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-body">Message</Label>
            <Textarea
              id="t-body"
              rows={5}
              value={form.body}
              placeholder="Hello {{1}}, your check-in is recorded. You have {{2}} servings left this month."
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Write variables as {"{{1}}"}, {"{{2}}"} and so on.
            </p>
          </div>

          {vars.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Sample values</p>
              <p className="text-xs text-muted-foreground">
                Meta needs one example per variable to review the template.
              </p>
              {vars.map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span className="w-12 text-sm text-muted-foreground">{`{{${n}}}`}</span>
                  <Input
                    value={samples[n] || ""}
                    placeholder={n === 1 ? "Pawan" : "12"}
                    onChange={(e) => setSamples({ ...samples, [n]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="t-footer">Footer (optional)</Label>
            <Input
              id="t-footer"
              value={form.footer}
              placeholder="All In One Wellness, Shri Chatap"
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-buttons">Quick reply buttons (optional)</Label>
            <Input
              id="t-buttons"
              value={form.buttons}
              placeholder="Yes, Not now"
              onChange={(e) => setForm({ ...form, buttons: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Up to three, separated by commas.
            </p>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">Preview</p>
            <div className="rounded-lg bg-background p-3 text-sm shadow-sm">
              {form.header && <p className="font-semibold">{fill(form.header, samples)}</p>}
              <p className="whitespace-pre-wrap">
                {fill(form.body, samples) || "Your message appears here."}
              </p>
              {form.footer && (
                <p className="mt-2 text-xs text-muted-foreground">{form.footer}</p>
              )}
            </div>
          </div>

          {problems.length > 0 && (
            <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {problems.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          )}
        </div>
      </ResponsiveDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template from your WhatsApp Business account itself, not just this
              app. Any automatic message using it will stop working until you pick another one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  remove.mutate({ name: toDelete.name, template_id: toDelete.id });
                }
                setToDelete(null);
              }}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
