import { useState } from "react";
import { useMiwChallenges, useMiwReport } from "@/hooks/useWellness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayOnlineDialog } from "@/components/wellness/PayOnlineDialog";
import { formatCurrency, formatDate, todayIst } from "@/lib/formatters";
import { miwChange, miwDay } from "@/lib/miw";
import { Trophy } from "lucide-react";

export function MiwChallengeCard({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { data: challenges } = useMiwChallenges();
  const today = todayIst();
  const challenge = challenges?.find(c => c.status === "open" && c.end_date >= today);
  const { data: report, isLoading, error } = useMiwReport(challenge?.id ?? null);
  const participant = report?.participants.find(p => p.member_id === memberId);
  const change = participant ? miwChange(participant.start_weight, participant.latest_weight) : null;
  const [open, setOpen] = useState(false);
  if (!challenge) return null;
  return <><Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-5 w-5 text-primary" />{challenge.name}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{formatDate(challenge.start_date)} — {formatDate(challenge.end_date)}</p>{participant ? <><p className="font-semibold">You’re in {today < challenge.start_date ? "— starts soon" : `— Day ${miwDay(challenge.start_date, today)} of 21`}</p><p>{change == null ? "Weight progress awaiting readings" : `${Math.abs(change).toFixed(2)} kg ${change <= 0 ? "lost" : "gained"}`}</p></> : <Button className="w-full" onClick={() => setOpen(true)} disabled={isLoading || !!error}>Join MIW 21-Day Challenge · {formatCurrency(Number(challenge.fee))}</Button>}{error && <p className="text-sm text-destructive">Could not load registration status.</p>}</CardContent></Card><PayOnlineDialog open={open} onOpenChange={setOpen} memberName={memberName} pinkBalance={0} challenge={challenge} /></>;
}