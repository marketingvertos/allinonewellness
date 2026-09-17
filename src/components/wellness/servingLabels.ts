/** Human-friendly labels for serving_transactions.txn_type. */
export const SERVING_TXN_LABELS: Record<string, string> = {
  membership_allocation: "Plan activated",
  daily_deduction: "Check-in",
  manual_adjustment: "Manual adjustment",
  renewal_allocation: "Renewal",
  refund_adjustment: "Refund",
  pack_and_issue: "Packed / issued",
};

export function servingTxnLabel(type: string) {
  return SERVING_TXN_LABELS[type] ?? type.replace(/_/g, " ");
}
