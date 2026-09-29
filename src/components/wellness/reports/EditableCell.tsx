import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function EditableCell({ value, onSave, format }: { value: number; onSave: (v: number) => void; format?: (v: number) => string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => setDraft(String(value ?? 0)), [value]);
  const commit = () => {
    setEditing(false);
    const n = Number(draft);
    if (!Number.isNaN(n) && n !== value) onSave(n);
  };
  if (editing) {
    return (
      <Input autoFocus type="number" value={draft} className="h-7 w-24 text-right print:hidden"
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }} />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="w-full rounded px-1 text-right underline decoration-dotted decoration-muted-foreground underline-offset-4 hover:bg-accent">
      {format ? format(value ?? 0) : value ?? 0}
    </button>
  );
}
