import { useUpcomingCelebrations } from "@/hooks/useWellness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { Cake, Heart, MessageCircle } from "lucide-react";

export function BirthdaysCard() {
  const { data: celebrations } = useUpcomingCelebrations(30);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Upcoming birthdays &amp; anniversaries</CardTitle>
          <CardDescription>Next 30 days</CardDescription>
        </div>
        <Cake className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        {celebrations?.length ? (
          celebrations.slice(0, 8).map((c) => {
            const isBirthday = c.kind === "birthday";
            const wish = isBirthday
              ? `Happy Birthday ${c.full_name}! Wishing you a healthy and wonderful year ahead from all of us at the wellness centre.`
              : `Happy Anniversary ${c.full_name}! Wishing you and your partner health and happiness — from all of us at the wellness centre.`;
            return (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {isBirthday ? <Cake className="h-3.5 w-3.5 text-muted-foreground" /> : <Heart className="h-3.5 w-3.5 text-muted-foreground" />}
                    {c.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.nextDate)} · {isBirthday ? `turning ${c.years}` : `${c.years} years together`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.daysAway === 0 ? "default" : c.daysAway <= 7 ? "secondary" : "outline"}>
                    {c.daysAway === 0 ? "Today" : `${c.daysAway}d`}
                  </Badge>
                  <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Send WhatsApp wish">
                    <a
                      href={`https://wa.me/91${c.mobile_number.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(wish)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No birthdays or anniversaries in the next 30 days.</p>
        )}
      </CardContent>
    </Card>
  );
}
