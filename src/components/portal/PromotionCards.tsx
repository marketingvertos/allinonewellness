import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Gift } from "lucide-react";
import { useMemberOffers } from "@/hooks/usePromotions";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function PromotionCards({ memberId, memberMode }: { memberId: string; memberMode?: string }) {
  const { data } = useMemberOffers(memberId, memberMode);
  if (!data?.length) return null;

  return (
    <div className="space-y-3">
      {data.map(({ promo, progress }) => {
        const tracked = promo.offer_type !== "announcement" && !!promo.target_count;
        const count = progress?.current_count ?? 0;
        const target = promo.target_count ?? 1;
        const qualified = tracked && !!progress?.qualified;
        return (
          <Card
            key={promo.id}
            className={cn(
              "overflow-hidden border-l-4",
              qualified ? "border-l-primary bg-primary/5" : promo.offer_type === "announcement" ? "border-l-accent" : "border-l-amber-500",
            )}
          >
            {promo.banner_message && (
              <div className="bg-muted px-4 py-2 text-sm font-medium">{promo.banner_message}</div>
            )}
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">{promo.icon}</span>
                <div>
                  <h3 className="font-semibold">{promo.title}</h3>
                  {promo.description && <p className="text-sm text-muted-foreground">{promo.description}</p>}
                </div>
              </div>
              {tracked && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Your progress</span>
                    <span className="font-semibold">{Math.min(count, target)} of {target}</span>
                  </div>
                  <Progress value={Math.min(100, (count / target) * 100)} className="h-2.5" />
                  {qualified ? (
                    <div className="rounded-md bg-primary/10 p-3 text-center">
                      <p className="flex items-center justify-center gap-1 text-sm font-semibold text-primary">
                        <CheckCircle className="h-4 w-4" /> Congratulations! You qualified 🎉
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress?.reward_claimed ? "✅ Reward received" : "Your coach will give you the reward."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{target - count} more to qualify</p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1 text-sm">
                {promo.reward_description && (
                  <span className="flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Reward:</span> {promo.reward_description}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {promo.offer_type === "referral_challenge"
                    ? `Valid till ${formatDate(promo.end_date)}`
                    : `${promo.offer_type === "qualification" ? "Qualification: " : ""}${formatDate(promo.start_date)} – ${formatDate(promo.end_date)}`}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
