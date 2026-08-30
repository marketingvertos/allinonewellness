import { useMemberCategories } from "@/hooks/useWellness";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  includeAll?: boolean;
  placeholder?: string;
}

export function CategoryPicker({ value, onChange, includeAll, placeholder = "Select category" }: Props) {
  const { data: categories } = useMemberCategories();

  return (
    <Select
      value={value ?? (includeAll ? "all" : "")}
      onValueChange={(v) => onChange(v === "all" ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All categories</SelectItem>}
        {(categories ?? []).map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
