import { useMemo, useState } from "react";
import {
  useWlpSessions,
  useCreateWlpSession,
  useDeleteWlpSession,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatters";
import { CalendarPlus, Moon, Search, Trash2, Undo2, Users, QrCode, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function WellnessWlp() {
  const { data: sessions, isLoading } = useWlpSessions();
  const createSession = useCreateWlpSession();
  const deleteSession = useDeleteWlpSession();

  const [title, setTitle] = useState("WLP Session");
  const [date, setDate] = useState(istToday());
  const [notes, setNotes] = useState("");

  const today = istToday();
  const todaySession = sessions?.find((s) => s.session_date === today) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeSession = selectedId
    ? sessions?.find((s) => s.id === selectedId) ?? todaySession
    : todaySession;

  const pastSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.id !== activeSession?.id),
    [sessions, activeSession],
  );

  const handleCreate = () => {
    createSession.mutate(
      { title: title.trim() || "WLP Session", sessionDate: date, notes: notes.trim() || undefined },
      {
        onSuccess: (s) => {
          setSelectedId(s.id);
          setTitle("WLP Session");
          setNotes("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageBanner
        title="WLP Sessions"
        description="Create evening WLP sessions, check members in, and track attendance. Each check-in deducts one serving."
      />

      {/* Create session */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4" /> Create a session
          </CardTitle>
          <CardDescription>One session per calendar date. Staff can check members in once a session is created.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="wlp-title">Title</Label>
              <Input id="wlp-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full sm:w-48" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wlp-date">Date</Label>
              <Input id="wlp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-44" />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="wlp-notes">Notes</Label>
              <Textarea id="wlp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} placeholder="Optional" />
            </div>
            <Button onClick={handleCreate} disabled={createSession.isPending || !date}>
              {createSession.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active session */}
      {activeSession && (
        <ActiveSessionPanel
          session={activeSession}
          onDelete={() => {
            deleteSession.mutate(activeSession.id, { onSuccess: () => setSelectedId(null) });
          }}
          deleting={deleteSession.isPending}
        />
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
        <p className="py-16 text-center text-muted-foreground">No WLP sessions yet. Create one above to get started.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ActiveSessionPanel({
  session,
  onDelete,
  deleting,
}: {
  session: WlpSession;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { data: checkins } = useWlpCheckins(session.id);
  const checkinMember = useWlpCheckinMember();
  const undoCheckin = useUndoWlpCheckin();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const { data: members } = useWellnessMembers(query);
  const results = (members ?? []).slice(0, 6);

  const checkedInIds = useMemo(() => new Set((checkins ?? []).map((c) => c.member_id)), [checkins]);

  const [showQr, setShowQr] = useState(false);
  const qrUrl = `${window.location.origin}/portal/wlp/${session.id}`;

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
        <div className="flex items-center gap-2">
          <Badge className="text-sm">{checkins?.length ?? 0} checked in</Badge>
          <Button size="sm" variant="outline" onClick={() => setShowQr((v) => !v)}>
            <QrCode className="mr-1 h-4 w-4" /> QR
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting || (checkins?.length ?? 0) > 0} title="Delete session (only if empty)">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showQr && (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Members scan this QR to self-check-in:</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
              alt="WLP session QR code"
              className="h-48 w-48 rounded"
            />
            <p className="max-w-xs break-all text-center text-xs text-muted-foreground">{qrUrl}</p>
          </div>
        )}

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
