import { useUpcomingBirthdays } from "@/hooks/useWellness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { Cake, MessageCircle } from "lucide-react";

export function BirthdaysCard() {
  const { data: birthdays } = useUpcomingBirthdays(30);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Upcoming birthdays</CardTitle>
          <CardDescription>Next 30 days</CardDescription>
        </div>
        <Cake className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        {birthdays?.length ? (
          birthdays.slice(0, 8).map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{b.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(b.nextDate)} · turning {b.turningAge}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.daysAway === 0 ? "default" : b.daysAway <= 7 ? "secondary" : "outline"}>
                  {b.daysAway === 0 ? "Today" : `${b.daysAway}d`}
                </Badge>
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Send WhatsApp wish"
                >
                  <a
                    href={`https://wa.me/91${b.mobile_number.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                      `Happy Birthday ${b.full_name}! Wishing you a healthy and wonderful year ahead from all of us at the wellness centre.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No birthdays in the next 30 days.</p>
        )}
      </CardContent>
    </Card>
  );
}
