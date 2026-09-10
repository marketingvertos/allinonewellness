import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MEMBER_TAGS } from "./memberMeta";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  idPrefix?: string;
}

/** Simple multi-select for the fixed wellness member tags. */
export function TagPicker({ value, onChange, idPrefix = "tag" }: Props) {
  const toggle = (tag: string, checked: boolean) => {
    onChange(checked ? [...value.filter((t) => t !== tag), tag] : value.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-wrap gap-4 rounded-md border p-3">
      {MEMBER_TAGS.map((t) => (
        <div key={t.value} className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-${t.value}`}
            checked={value.includes(t.value)}
            onCheckedChange={(c) => toggle(t.value, c === true)}
          />
          <Label htmlFor={`${idPrefix}-${t.value}`} className="cursor-pointer text-sm font-normal">
            {t.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
