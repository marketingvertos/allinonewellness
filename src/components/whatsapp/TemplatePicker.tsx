import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppTemplates, type WhatsAppTemplate } from "@/hooks/useWhatsApp";

export interface TemplateSelection {
  template_name: string;
  template_language: string;
  template_variables: string[];
  preview: string;
}

export function fillTemplate(body: string, vars: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => vars[Number(n) - 1] || `{{${n}}}`);
}

export default function TemplatePicker({
  open,
  onOpenChange,
  onSend,
  sending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (selection: TemplateSelection) => void;
  sending?: boolean;
}) {
  const { data: templates = [], isLoading, error } = useWhatsAppTemplates(open);
  const [selected, setSelected] = useState<WhatsAppTemplate | null>(null);
  const [vars, setVars] = useState<string[]>([]);

  const preview = useMemo(
    () => (selected ? fillTemplate(selected.body, vars) : ""),
    [selected, vars],
  );

  const choose = (t: WhatsAppTemplate) => {
    setSelected(t);
    setVars(Array.from({ length: t.variable_count }, () => ""));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Approved WhatsApp templates</DialogTitle>
          <DialogDescription>
            Use a template when the member has not written to you in the last 24 hours.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your templates…
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not read your templates"}
          </p>
        )}

        {!isLoading && !error && (
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <ScrollArea className="h-64 rounded-md border">
              {!templates.length && (
                <p className="p-3 text-sm text-muted-foreground">
                  No approved templates found on your WhatsApp account yet.
                </p>
              )}
              {templates.map((t) => (
                <button
                  key={`${t.name}-${t.language}`}
                  onClick={() => choose(t)}
                  className={cn(
                    "w-full border-b px-3 py-2 text-left text-sm hover:bg-muted/60",
                    selected?.name === t.name && "bg-muted",
                  )}
                >
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.language}</span>
                </button>
              ))}
            </ScrollArea>

            <div className="space-y-3">
              {!selected && (
                <p className="text-sm text-muted-foreground">
                  Pick a template to fill in its details.
                </p>
              )}
              {selected && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selected.language}</Badge>
                    {selected.category && <Badge variant="outline">{selected.category}</Badge>}
                  </div>
                  {vars.map((v, i) => (
                    <div key={i} className="space-y-1">
                      <Label className="text-xs">Value {i + 1}</Label>
                      <Input
                        value={v}
                        onChange={(e) =>
                          setVars((old) => old.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder={`Fills {{${i + 1}}}`}
                      />
                    </div>
                  ))}
                  <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                    {preview || "This template has no message body."}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || sending || vars.some((v) => !v.trim())}
            onClick={() =>
              selected &&
              onSend({
                template_name: selected.name,
                template_language: selected.language,
                template_variables: vars,
                preview,
              })}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
