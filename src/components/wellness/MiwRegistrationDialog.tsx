import { useEffect, useState } from "react";
import { useMiwChallenges, useMiwRegisterMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentInput, createDefaultPayment, paymentsPayload } from "./PaymentInput";
import { formatCurrency, todayIst } from "@/lib/formatters";

export function MiwRegistrationDialog({ memberId, open, onOpenChange, onRegistered }: { memberId: string; open: boolean; onOpenChange: (open: boolean) => void; onRegistered?: () => void }) {
  const { data: challenges, error } = useMiwChallenges();
  const available = (challenges ?? []).filter(c => c.status === "open" && c.end_date >= todayIst());
  const [challengeId, setChallengeId] = useState("");
  const [payments, setPayments] = useState(() => createDefaultPayment(500));
  const register = useMiwRegisterMember();
  const challenge = available.find(c => c.id === challengeId);
  useEffect(() => { if (open && available[0] && !challengeId) { setChallengeId(available[0].id); setPayments(createDefaultPayment(Number(available[0].fee))); } }, [open, available, challengeId]);
  const save = async () => {
    try { await register.mutateAsync({ memberId, challengeId, payments: paymentsPayload(payments) }); onRegistered?.(); onOpenChange(false); } catch { /* toast is shown by mutation */ }
  };
  return <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="MIW registration" footer={<Button onClick={save} disabled={!challenge || !paymentsPayload(payments).length || register.isPending}>Record payment & register</Button>}>
    <div className="space-y-4">
      {error && <p role="alert" className="text-destructive">{error.message}</p>}
      <Select value={challengeId} onValueChange={id => { setChallengeId(id); setPayments(createDefaultPayment(Number(available.find(c => c.id === id)?.fee ?? 500))); }}><SelectTrigger><SelectValue placeholder="Select challenge" /></SelectTrigger><SelectContent>{available.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      {challenge ? <><p className="text-sm">Registration fee: {formatCurrency(Number(challenge.fee))}</p><PaymentInput totalAmount={Number(challenge.fee)} payments={payments} onChange={setPayments} /></> : <p className="text-sm text-muted-foreground">No challenge is open for registration.</p>}
    </div>
  </ResponsiveDialog>;
}