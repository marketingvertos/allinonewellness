import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCheckInWithWeight, useTodayAttendance, useWellnessMembers } from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/formatters";
import { Camera, QrCode, Search } from "lucide-react";
import { CentreQrCard } from "@/components/wellness/CentreQrCard";
import { QrScannerSheet } from "@/components/wellness/QrScannerSheet";
import { WellnessListRow } from "@/components/wellness/WellnessListRow";



export default function WellnessCheckIn() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);

  const [weights, setWeights] = useState<Record<string, string>>({});
  const { data: members } = useWellnessMembers(query);
  const { data: today } = useTodayAttendance();
  const checkIn = useCheckInWithWeight();

  const checkedInIds = useMemo(() => new Set((today ?? []).map((a) => a.member_id)), [today]);
  const results = (members ?? []).slice(0, 8);

  const submit = async (memberId: string, skipCheckIn: boolean) => {
    const raw = weights[memberId];
    await checkIn.mutateAsync({
      memberId,
      skipCheckIn,
      weight: raw ? Number(raw) : null,
      recordedBy: user?.id ?? null,
      method: "staff_entry",
    });
    setWeights((w) => ({ ...w, [memberId]: "" }));
  };

  return (
    <div className="space-y-6">
      <PageBanner
        title="Daily check-in"
        description="Scan or search a member, record today's weight, then check them in. One serving is deducted automatically."
      >
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link to="/wellness/qr">
            <QrCode className="mr-2 h-4 w-4" /> Print check-in QR
          </Link>
        </Button>
      </PageBanner>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Find a member</CardTitle>
            <CardDescription>Weight is optional — leave it blank to just record the visit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="Scan barcode or type name / mobile number"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="shrink-0" onClick={() => setScanning(true)}>
                <Camera className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Scan</span>
              </Button>
            </div>

            {query.length > 1 &&
              results.map((m) => {
                const done = checkedInIds.has(m.id);
                return (
                  <WellnessListRow
                    key={m.id}
                    title={m.full_name}
                    meta={`${m.mobile_number}${m.current_weight ? ` · last ${m.current_weight} kg` : ""}`}
                    badges={done ? <Badge variant="secondary">Checked in</Badge> : undefined}
                    actions={
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        <Input
                          className="w-20 shrink-0"
                          inputMode="decimal"
                          placeholder="kg"
                          value={weights[m.id] ?? ""}
                          onChange={(e) => setWeights((w) => ({ ...w, [m.id]: e.target.value }))}
                        />
                        {done ? (
                          <Button
                            className="flex-1 sm:flex-none"
                            variant="outline"
                            disabled={!weights[m.id] || checkIn.isPending}
                            onClick={() => submit(m.id, true)}
                          >
                            Save weight
                          </Button>
                        ) : (
                          <Button
                            className="flex-1 sm:flex-none"
                            disabled={checkIn.isPending}
                            onClick={() => submit(m.id, false)}
                          >
                            Check in
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}

          </CardContent>
        </Card>
        <CentreQrCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s attendance ({today?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {today?.length ? (
            today.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.wellness_members?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.visit_time)}</p>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground sm:text-sm">
                  {a.serving_deducted ? `${a.remaining_balance_snapshot} servings left` : "Trial visit"}
                </span>
              </div>

            ))
          ) : (
            <p className="text-sm text-muted-foreground">No check-ins recorded today.</p>
          )}
        </CardContent>
      </Card>

      <QrScannerSheet
        open={scanning}
        onOpenChange={setScanning}
        title="Scan member code"
        description="Scan a member's QR or barcode to look them up instantly."
        onResult={(code) => setQuery(code)}
      />
    </div>

  );
}
