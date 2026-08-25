import { useBatches } from "@/hooks/useWellness";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

const NONE = "__none__";

export function BatchPicker({ value, onChange }: Props) {
  const { data: batches } = useBatches();

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger>
        <SelectValue placeholder="No batch" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No batch</SelectItem>
        {(batches ?? [])
          .filter((b) => b.status === "active" || b.id === value)
          .map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
              {b.max_capacity ? ` (${b.memberCount}/${b.max_capacity})` : ""}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
