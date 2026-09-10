import { useState } from "react";
import {
  PINK_CARD_SERVING_VALUE,
  useAdjustPinkCard,
  useIsWellnessManager,
  usePinkCardLedger,
} from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { HeartHandshake } from "lucide-react";

export function pinkCardValue(balance: number | null | undefined) {
  return (balance ?? 0) * PINK_CARD_SERVING_VALUE;
}

export function PinkCardBadge({ balance }: { balance: number | null | undefined }) {
  if (!balance || balance <= 0) return null;
  return (
    <Badge className="border-transparent bg-[hsl(330_70%_55%)] text-white hover:bg-[hsl(330_70%_50%)]">
      Pink Card {formatCurrency(pinkCardValue(balance))}
    </Badge>
  );
}

function reasonLabel(reason: string, referredName?: string | null) {
  switch (reason) {
    case "trial_referral":
      return referredName ? `Trial referral — ${referredName}` : "Trial referral";
    case "membership_referral":
      return referredName ? `Membership referral — ${referredName}` : "Membership referral";
    case "renewal_redemption":
      return "Redeemed at renewal";
    case "manual_adjustment":
      return "Manual adjustment";
    default:
      return reason;
  }
}

interface Props {
  memberId: string;
  balance: number | null | undefined;
  /** Hide the staff-only manual adjustment control (member portal). */
  readOnly?: boolean;
}

export function PinkCardPanel({ memberId, balance, readOnly }: Props) {
  const { data: ledger } = usePinkCardLedger(memberId);
  const isManager = useIsWellnessManager();
  const adjust = useAdjustPinkCard();
  const [open, setOpen] = useState(false);
  const [change, setChange] = useState("1");
  const [note, setNote] = useState("");

  const bal = balance ?? 0;

  return (
    <Card className="border-[hsl(330_70%_55%/0.4)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[hsl(330_70%_45%)]">
          <HeartHandshake className="h-4 w-4" /> Pink Card
        </CardTitle>
        {!readOnly && isManager && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Adjust
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold text-[hsl(330_70%_45%)]">
            {bal} serving{bal === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(pinkCardValue(bal))} credit, applied as a discount on the next renewal.
          </p>
        </div>

        {(ledger ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Pink Card activity yet. Refer friends and family to earn credit.
          </p>
        ) : (
          <div className="space-y-2">
            {(ledger ?? []).map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{reasonLabel(row.reason, row.referred?.full_name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.created_at)} · balance {row.balance_after}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <span
                  className={
                    row.change >= 0
                      ? "font-semibold text-[hsl(330_70%_45%)]"
                      : "font-semibold text-muted-foreground"
                  }
                >
                  {row.change > 0 ? "+" : ""}
                  {row.change}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Adjust Pink Card credit"
        description="Add or remove servings for corrections or promotions."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!Number(change) || adjust.isPending}
              onClick={async () => {
                await adjust.mutateAsync({ memberId, change: Number(change), note: note.trim() || null });
                setOpen(false);
                setNote("");
                setChange("1");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pc-change">Servings (use a minus sign to remove)</Label>
            <Input id="pc-change" value={change} onChange={(e) => setChange(e.target.value.replace(/[^\d-]/g, ""))} />
            <p className="text-xs text-muted-foreground">
              {Number(change) ? formatCurrency(Number(change) * PINK_CARD_SERVING_VALUE) : "—"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc-note">Note</Label>
            <Input id="pc-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change" />
          </div>
        </div>
      </ResponsiveDialog>
    </Card>
  );
}
