import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useMemberAttendance, useWeightHistory } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/formatters";

export default function PortalHistory() {
  const { data: identity } = useMemberIdentity();
  const { data: visits } = useMemberAttendance(identity?.memberId ?? undefined);
  const { data: weights } = useWeightHistory(identity?.memberId ?? undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My visits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visits?.length ? (
            visits.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{formatDate(v.visit_date)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(v.visit_time)}</p>
                </div>
                <span className="text-muted-foreground">
                  {v.serving_deducted ? `${v.remaining_balance_snapshot} left` : "Trial visit"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weight log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {weights?.length ? (
            weights
              .slice()
              .reverse()
              .map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span>{formatDate(w.recorded_date)}</span>
                  <span className="font-medium">{w.weight} kg</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-muted-foreground">No weight entries yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
