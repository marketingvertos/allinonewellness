import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type PaymentModeValue = "cash" | "upi" | "online" | "card";

export interface PaymentLine {
  id: string;
  amount: string;
  mode: PaymentModeValue;
  reference: string;
}

const MODES: { value: PaymentModeValue; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "online", label: "Online" },
  { value: "card", label: "Card" },
];

function newLine(amount?: number): PaymentLine {
  return {
    id: crypto.randomUUID(),
    amount: amount != null && amount > 0 ? String(amount) : "",
    mode: "cash",
    reference: "",
  };
}

export function createDefaultPayment(totalAmount: number): PaymentLine[] {
  return [newLine(totalAmount)];
}

export function paymentsTotal(payments: PaymentLine[]): number {
  return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/** Payment lines ready for the record_payment RPC. */
export function paymentsPayload(payments: PaymentLine[]) {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => ({
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.reference.trim() || undefined,
    }));
}

interface PaymentInputProps {
  totalAmount: number;
  payments: PaymentLine[];
  onChange: (payments: PaymentLine[]) => void;
}

export function PaymentInput({ totalAmount, payments, onChange }: PaymentInputProps) {
  const total = paymentsTotal(payments);
  const isSplit = payments.length > 1;
  const isBalanced = Math.abs(total - totalAmount) < 0.01;

  const updateLine = (id: string, patch: Partial<PaymentLine>) =>
    onChange(payments.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addLine = () => {
    const remaining = Math.max(0, totalAmount - total);
    onChange([...payments, newLine(remaining)]);
  };

  const removeLine = (id: string) => {
    const next = payments.filter((p) => p.id !== id);
    if (next.length === 1 && !Number(next[0].amount)) {
      next[0] = { ...next[0], amount: String(totalAmount) };
    }
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Payment</p>

      {payments.map((line, idx) => (
        <div key={line.id} className={cn("space-y-3", isSplit && "rounded-md border bg-muted/30 p-3")}>
          {isSplit && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Payment {idx + 1}</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(line.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`pay-amt-${line.id}`}>Amount</Label>
              <Input
                id={`pay-amt-${line.id}`}
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <ToggleGroup
                type="single"
                value={line.mode}
                onValueChange={(v) => v && updateLine(line.id, { mode: v as PaymentModeValue })}
                className="justify-start flex-wrap"
              >
                {MODES.map((m) => (
                  <ToggleGroupItem key={m.value} value={m.value} size="sm" className="px-3">
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`pay-ref-${line.id}`}>Reference / Transaction ID (optional)</Label>
            <Input
              id={`pay-ref-${line.id}`}
              value={line.reference}
              onChange={(e) => updateLine(line.id, { reference: e.target.value })}
              placeholder={
                line.mode === "upi"
                  ? "UPI transaction ID"
                  : line.mode === "card"
                    ? "Card last 4 digits"
                    : line.mode === "online"
                      ? "Transaction reference"
                      : "Receipt number"
              }
            />
          </div>
        </div>
      ))}

      {payments.length < 4 && (
        <Button type="button" size="sm" variant="outline" onClick={addLine}>
          <Plus className="mr-1 h-4 w-4" />
          {isSplit ? "Add another line" : "Add split payment"}
        </Button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span className="font-medium">Total: {formatCurrency(total)}</span>
        <span className={cn("text-xs", isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
          {isBalanced
            ? "Matches plan amount"
            : total < totalAmount
              ? `${formatCurrency(totalAmount - total)} short`
              : `${formatCurrency(total - totalAmount)} over plan price`}
        </span>
      </div>
    </div>
  );
}
