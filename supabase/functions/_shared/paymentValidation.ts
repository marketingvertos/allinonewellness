/** Only a captured payment matching the stored order can fulfil a purchase. */
export function matchesCapturedPayment(payment: { id?: string; status?: string; order_id?: string; amount?: number; currency?: string }, paymentId: string, orderId: string, amountPaise: number) {
  return payment.id === paymentId && payment.status === "captured" && payment.order_id === orderId && payment.amount === amountPaise && payment.currency === "INR";
}