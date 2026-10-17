import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MEMBER_TAGS } from "./memberMeta";
import { useState } from "react";
import { MiwRegistrationDialog } from "./MiwRegistrationDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  idPrefix?: string;
  memberId?: string;
}

/** Simple multi-select for the fixed wellness member tags. */
export function TagPicker({ value, onChange, idPrefix = "tag", memberId }: Props) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const toggle = (tag: string, checked: boolean) => {
    if (tag === "miw") { if (checked) setRegisterOpen(true); else setRemoveOpen(true); return; }
    onChange(checked ? [...value.filter((t) => t !== tag), tag] : value.filter((t) => t !== tag));
  };

  return (
    <><div className="flex flex-wrap gap-4 rounded-md border p-3">
      {MEMBER_TAGS.map((t) => (
        <div key={t.value} className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-${t.value}`}
            checked={value.includes(t.value)}
            disabled={t.value === "miw" && !memberId}
            onCheckedChange={(c) => toggle(t.value, c === true)}
          />
          <Label htmlFor={`${idPrefix}-${t.value}`} className="cursor-pointer text-sm font-normal">
            {t.label}
          </Label>
        </div>
      ))}
    </div>
    {memberId && <MiwRegistrationDialog memberId={memberId} open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={() => onChange([...value.filter(t => t !== "miw"), "miw"])} />}
    <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove MIW tag?</AlertDialogTitle><AlertDialogDescription>Challenge participation and payment history will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onChange(value.filter(t => t !== "miw"))}>Remove tag</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
