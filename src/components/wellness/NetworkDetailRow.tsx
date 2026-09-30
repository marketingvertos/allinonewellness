import type { NetworkMember } from "@/hooks/useWellness";
import { formatDate } from "@/lib/formatters";

type NameMap = Record<string, { name: string; parent: string | null }>;

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

function statusInfo(m: NetworkMember): { label: string; cls: string } {
  if (m.status === "trial") return { label: "Trial", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" };
  if (m.status === "renewal_due") return { label: "Renewal Due", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
  if (m.status === "expired" || m.membership_status === "expired")
    return { label: "Expired", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" };
  if (m.membership_status === "active" || m.membership_status === "expiring_soon")
    return { label: "Active ✓", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
  return { label: m.plan_name ? "Inactive" : "No membership", cls: "bg-muted text-muted-foreground" };
}

function planLabel(m: NetworkMember): string {
  if (!m.plan_name) return "No active plan";
  if (m.plan_type === "membership" && m.total_servings === 30 && m.duration_days === 30) return "UMS 30";
  return m.plan_name;
}

function notCountedReason(m: NetworkMember): string {
  if (m.status === "trial" || m.plan_type === "trial") return "trial only";
  if (!m.plan_name) return "no active plan";
  if (!(m.total_servings === 30 && m.duration_days === 30 && m.plan_type === "membership")) return "not UMS 30";
  if (m.status === "expired" || m.membership_status === "expired") return "expired";
  if (m.status === "renewal_due") return "renewal due";
  return "not renewed this month";
}

function safeDate(d: string) {
  try {
    return formatDate(d);
  } catch {
    return d;
  }
}

export function NetworkDetailRow({
  m,
  nameById,
  onOpen,
}: {
  m: NetworkMember;
  nameById: NameMap;
  onOpen?: (id: string) => void;
}) {
  const st = statusInfo(m);
  const expired = st.label === "Expired";
  const dateLabel = m.end_date ? `${expired ? "Expired" : "Renews"}: ${safeDate(m.end_date)}` : "";
  const counted = !!m.qualifies_this_month;
  const tag = counted
    ? m.depth === 1
      ? { text: "✅ Counted for Master & Ambassador", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" }
      : { text: "✅ Counted for Master", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" }
    : { text: `⬜ Not counted — ${notCountedReason(m)}`, cls: "bg-muted text-muted-foreground" };

  const chain: string[] = [];
  let cur = m.referred_by;
  for (let i = 0; cur && nameById[cur] && i < 20; i++) {
    chain.push(nameById[cur].name);
    cur = nameById[cur].parent;
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      {onOpen ? (
        <button className="text-left text-sm font-medium hover:underline" onClick={() => onOpen(m.member_id)}>
          {m.full_name}
        </button>
      ) : (
        <p className="text-sm font-medium">{m.full_name}</p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className={`${pill} bg-muted`}>{planLabel(m)}</span>
        <span className={`${pill} ${st.cls}`}>{st.label}</span>
        {dateLabel && <span className={`${pill} bg-muted font-normal`}>{dateLabel}</span>}
        {m.remaining_servings != null && !expired && (
          <span className={`${pill} bg-muted font-normal`}>{m.remaining_servings} servings left</span>
        )}
      </div>
      <div className="mt-2">
        <span className={`${pill} ${tag.cls}`}>{tag.text}</span>
      </div>
      {m.depth > 1 && chain.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">↳ Referred by: {chain.join(" → ")}</p>
      )}
    </div>
  );
}
