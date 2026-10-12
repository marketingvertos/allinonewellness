import { useState } from "react";
import {
  PINK_CARD_SERVING_VALUE,
  useAdjustPinkCard,
  useIsWellnessManager,
  usePinkCardLedger,
  useRedeemPinkCard,
  useRedeemPinkCardAsServings,
  useWellnessMember,
} from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    case "serving_redemption":
      return "Redeemed as extra servings";
    case "referral_reversal":
      return referredName ? `Referral reversed — ${referredName}` : "Referral reversed";
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
  /** Who introduced this member — shown so missing credits are easy to spot. */
  referrerId?: string | null;
}

export function PinkCardPanel({ memberId, balance, readOnly, referrerId }: Props) {
  const { data: ledger } = usePinkCardLedger(memberId);
  const { data: referrer } = useWellnessMember(referrerId ?? undefined);
  const isManager = useIsWellnessManager();
  const adjust = useAdjustPinkCard();
  const redeem = useRedeemPinkCard();
  const redeemServings = useRedeemPinkCardAsServings();
  const [open, setOpen] = useState(false);
  const [change, setChange] = useState("1");
  const [note, setNote] = useState("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemMode, setRedeemMode] = useState<"renewal" | "servings">("renewal");
  const [credits, setCredits] = useState("0");
  const [redeemNote, setRedeemNote] = useState("");

  const bal = balance ?? 0;
  const creditsNum = Number(credits) || 0;

  return (
    <Card className="border-[hsl(330_70%_55%/0.4)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[hsl(330_70%_45%)]">
          <HeartHandshake className="h-4 w-4" /> Pink Card
        </CardTitle>
        {!readOnly && isManager && (
          <div className="flex items-center gap-2">
            {bal > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCredits(String(bal));
                  setRedeemNote("");
                  setRedeemMode("renewal");
                  setRedeemOpen(true);
                }}
              >
                Mark redeemed
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Adjust
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold text-[hsl(330_70%_45%)]">
            {bal} serving{bal === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(pinkCardValue(bal))} credit — redeem as a renewal discount or extra servings.
          </p>
          {referrer?.full_name && (
            <p className="mt-1 text-sm">
              Introduced by <span className="font-medium">{referrer.full_name}</span>
            </p>
          )}
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
                    {row.reason === "referral_reversal"
                      ? row.note === "trial_referral"
                        ? " · trial credit"
                        : " · membership credit"
                      : row.note
                        ? ` · ${row.note}`
                        : ""}
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

      <ResponsiveDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        title="Redeem Pink Card credit"
        description="Choose how to use the credit — as a renewal discount or as extra servings on the active membership."
        footer={
          <>
            <Button variant="outline" onClick={() => setRedeemOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={creditsNum <= 0 || creditsNum > bal || redeem.isPending || redeemServings.isPending}
              onClick={async () => {
                if (redeemMode === "servings") {
                  await redeemServings.mutateAsync({
                    memberId,
                    credits: creditsNum,
                    note: redeemNote.trim() || null,
                  });
                } else {
                  await redeem.mutateAsync({
                    memberId,
                    credits: creditsNum,
                    membershipId: null,
                    note: redeemNote.trim() || null,
                  });
                }
                setRedeemOpen(false);
                setRedeemNote("");
              }}
            >
              {redeem.isPending || redeemServings.isPending ? "Redeeming…" : "Redeem"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <RadioGroup value={redeemMode} onValueChange={(v) => setRedeemMode(v as "renewal" | "servings")} className="space-y-2">
            <Label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
              <RadioGroupItem value="renewal" />
              <div>
                <p className="font-medium">Renewal discount</p>
                <p className="text-xs text-muted-foreground">Apply as a discount on the next membership renewal</p>
              </div>
            </Label>
            <Label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
              <RadioGroupItem value="servings" />
              <div>
                <p className="font-medium">Extra servings</p>
                <p className="text-xs text-muted-foreground">Add servings to the active membership (1 credit = 1 serving)</p>
              </div>
            </Label>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="pc-redeem">Credits to redeem</Label>
            <Input
              id="pc-redeem"
              value={credits}
              onChange={(e) => setCredits(e.target.value.replace(/[^\d]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">
              {creditsNum ? formatCurrency(creditsNum * PINK_CARD_SERVING_VALUE) : "—"} · balance {bal}
            </p>
            {creditsNum > bal && (
              <p className="text-xs text-destructive">Cannot redeem more than the current balance.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc-redeem-note">Note (optional)</Label>
            <Input
              id="pc-redeem-note"
              value={redeemNote}
              onChange={(e) => setRedeemNote(e.target.value)}
              placeholder={redeemMode === "servings" ? "e.g. extra servings for referral reward" : "e.g. adjusted against renewal paid in cash"}
            />
          </div>
        </div>
      </ResponsiveDialog>
    </Card>
  );
}
