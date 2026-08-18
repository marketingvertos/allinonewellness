import type { WellnessStatus } from "@/hooks/useWellness";

const LABELS: Record<WellnessStatus, string> = {
  lead: "Lead",
  trial: "Trial",
  active_member: "Active",
  renewal_due: "Renewal due",
  expired: "Expired",
  inactive: "Inactive",
};

export function statusLabel(status: WellnessStatus): string {
  return LABELS[status] ?? status;
}

export function statusVariant(status: WellnessStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active_member":
      return "default";
    case "trial":
      return "secondary";
    case "renewal_due":
    case "expired":
      return "destructive";
    default:
      return "outline";
  }
}
