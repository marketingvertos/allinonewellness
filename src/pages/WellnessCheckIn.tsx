import { useMemo, useState } from "react";
import { useCheckIn, useTodayAttendance, useWellnessMembers } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/formatters";
import { Search } from "lucide-react";

export default function WellnessCheckIn() {
  const [query, setQuery] = useState("");
  const { data: members } = useWellnessMembers(query);
  const { data: today } = useTodayAttendance();
  const checkIn = useCheckIn();

  const checkedInIds = useMemo(() => new Set((today ?? []).map((a) => a.member_id)), [today]);
  const results = (members ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <PageBanner
        title="Daily check-in"
        description="Scan or search a member, then record today's visit. One serving is deducted automatically."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find a member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Scan barcode or type name / mobile number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {query.length > 1 &&
            results.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="font-medium">{m.full_name}</p>
                  <p className="text-sm text-muted-foreground">{m.mobile_number}</p>
                </div>
                {checkedInIds.has(m.id) ? (
                  <Badge variant="secondary">Checked in</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate({ memberId: m.id, method: "staff_entry" })}
                  >
                    Check in
                  </Button>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s attendance ({today?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {today?.length ? (
            today.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{a.wellness_members?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.visit_time)}</p>
                </div>
                <span className="text-muted-foreground">
                  {a.serving_deducted ? `${a.remaining_balance_snapshot} servings left` : "Trial visit"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No check-ins recorded today.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
