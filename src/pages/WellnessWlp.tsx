import { useMemo, useState } from "react";
import {
  useWlpSessions,
  useWlpCheckins,
  useWlpCheckinMember,
  useUndoWlpCheckin,
  useWellnessMembers,
  type WlpSession,
} from "@/hooks/useWellness";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatters";
import { Moon, Search, Undo2, Users, AlertTriangle, ChevronDown, ChevronUp, CalendarCheck, Info } from "lucide-react";

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function isWednesday(dateStr: string) {
  return new Date(dateStr + "T12:00:00").getDay() === 3;
}

export default function WellnessWlp() {
  const { data: sessions, isLoading } = useWlpSessions();

  const today = istToday();
  const todayIsWednesday = isWednesday(today);
  const todaySession = sessions?.find((s) => s.session_date === today) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeSession = selectedId
    ? sessions?.find((s) => s.id === selectedId) ?? todaySession
    : todaySession;

  const pastSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.id !== activeSession?.id && isWednesday(s.session_date)),
    [sessions, activeSession],
  );

  return (
    <div className="space-y-6">
      <PageBanner
        title="WLP Sessions"
        description="Wednesday evening WLP sessions run automatically. Members check in via QR after 4 PM every Wednesday."
      />

      {/* Auto-Wednesday info card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-primary" /> Wednesday schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>WLP sessions run <span className="font-medium text-foreground">every Wednesday</span> from 4 PM IST onwards.</p>
              <p>Sessions are created automatically when the first member scans the club QR on Wednesday evening. No manual scheduling required.</p>
              <p>
                Today is{" "}
                <span className="font-medium text-foreground">
                  {new Date(today + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long" })}
                </span>
                {todayIsWednesday
                  ? todaySession
                    ? " — session is active."
                    : " — session will start when the first member scans the QR after 4 PM."
                  : " — no WLP today."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active session */}
      {activeSession && (
        <ActiveSessionPanel session={activeSession} />
      )}

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-muted-foreground">Past sessions</h2>
          {pastSessions.map((s) => (
            <PastSessionRow key={s.id} session={s} onSelect={() => setSelectedId(s.id)} selected={s.id === selectedId} />
          ))}
        </div>
      )}

      {!isLoading && !sessions?.length && !activeSession && (
        <p className="py-16 text-center text-muted-foreground">No WLP sessions yet. Sessions are created automatically on Wednesdays after 4 PM.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ActiveSessionPanel({ session }: { session: WlpSession }) {
  const { data: checkins } = useWlpCheckins(session.id);
  const checkinMember = useWlpCheckinMember();
  const undoCheckin = useUndoWlpCheckin();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const { data: members } = useWellnessMembers(query);
  const results = (members ?? []).slice(0, 6);

  const checkedInIds = useMemo(() => new Set((checkins ?? []).map((c) => c.member_id)), [checkins]);

  const handleCheckin = (memberId: string) => {
    checkinMember.mutate(
      { sessionId: session.id, memberId },
      {
        onSuccess: (result) => {
          if (result.status === "duplicate") {
            toast({ title: "Already checked in", description: result.message, variant: "destructive" });
            return;
          }
          const msg = result.member_name ? `${result.member_name} checked in` : "Checked in";
          if (result.warning === "overdraft") {
            toast({ title: msg, description: `Warning: servings went to ${result.remaining}. Membership overdrafted.`, variant: "destructive" });
          } else if (result.warning === "no_membership") {
            toast({ title: msg, description: "No active membership — serving not deducted.", variant: "destructive" });
          } else {
            toast({ title: msg, description: result.remaining != null ? `${result.remaining} servings remaining` : undefined });
          }
        },
      },
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4 text-primary" />
            {session.title}
            <Badge variant="outline">{formatDate(session.session_date)}</Badge>
          </CardTitle>
          {session.notes && <CardDescription>{session.notes}</CardDescription>}
        </div>
        <Badge className="text-sm">{checkins?.length ?? 0} checked in</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search & check in */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search member by name or mobile"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {query.trim().length >= 2 &&
            results.map((m) => {
              const alreadyIn = checkedInIds.has(m.id);
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.mobile_number}</p>
                  </div>
                  {alreadyIn ? (
                    <Badge variant="secondary">Checked in</Badge>
                  ) : (
                    <Button size="sm" onClick={() => handleCheckin(m.id)} disabled={checkinMember.isPending}>
                      Check in
                    </Button>
                  )}
                </div>
              );
            })}
        </div>

        {/* Checked-in list */}
        {(checkins?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Attendance list
            </h3>
            {checkins!.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.wellness_members?.full_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.wellness_members?.mobile_number} · {new Date(c.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!c.serving_deducted && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> No serving
                    </Badge>
                  )}
                  {c.serving_deducted && <Badge variant="secondary">−1 serving</Badge>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => undoCheckin.mutate(c.id)} disabled={undoCheckin.isPending} title="Undo check-in">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function PastSessionRow({ session, onSelect, selected }: { session: WlpSession; onSelect: () => void; selected: boolean }) {
  const { data: checkins } = useWlpCheckins(selected ? session.id : null);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => {
            onSelect();
            setExpanded((v) => !v);
          }}
        >
          <div>
            <p className="font-medium">{session.title}</p>
            <p className="text-sm text-muted-foreground">{formatDate(session.session_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            {expanded && checkins ? (
              <Badge>{checkins.length} checked in</Badge>
            ) : (
              <Badge variant="outline">View</Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {expanded && selected && checkins && (
          <div className="mt-3 space-y-1 border-t pt-3">
            {checkins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins for this session.</p>
            ) : (
              checkins.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                  <span>{c.wellness_members?.full_name ?? "Member"}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.serving_deducted ? "−1 serving" : "no serving"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
