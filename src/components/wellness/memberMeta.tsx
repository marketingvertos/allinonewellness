import { Badge } from "@/components/ui/badge";
import { Building2, Monitor } from "lucide-react";

export type MemberMode = "physical" | "virtual";

export const MEMBER_TAGS = [
  { value: "coach", label: "Coach" },
  { value: "pc", label: "Preferred Customer" },
  { value: "mrp", label: "MRP Customer" },
] as const;

export function tagLabel(value: string): string {
  return MEMBER_TAGS.find((t) => t.value === value)?.label ?? value;
}

export function modeLabel(mode?: string | null): string {
  return mode === "virtual" ? "Virtual" : "Physical";
}

export function ModeBadge({ mode }: { mode?: string | null }) {
  const virtual = mode === "virtual";
  return (
    <Badge variant="outline" className="gap-1">
      {virtual ? <Monitor className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {virtual ? "Virtual" : "Physical"}
    </Badge>
  );
}

export function TagBadges({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <>
      {tags.map((t) => (
        <Badge key={t} variant="secondary">
          {tagLabel(t)}
        </Badge>
      ))}
    </>
  );
}
