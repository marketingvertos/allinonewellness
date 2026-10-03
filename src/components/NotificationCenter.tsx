import { useEffect, useRef, useState } from "react";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, Notification } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Cake, Check, Medal, Scale, Star, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { MemberSheetById } from "./wellness/MemberSheetById";
import { playAlertSound } from "@/hooks/useRealtimeAlerts";

const icons: Record<string, typeof Bell> = {
  milestone: Trophy,
  reward: Star,
  weight: Scale,
  title: Medal,
  birthday: Cake,
};

export function NotificationCenter() {
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Beep when a new unread notification arrives (not on first load).
  useEffect(() => {
    if (!notifications) return;
    const ids = new Set(notifications.map((n) => n.id));
    if (known.current && notifications.some((n) => !n.read && !known.current!.has(n.id))) playAlertSound();
    known.current = ids;
  }, [notifications]);

  const handleClick = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    const ref = n.reference_type ?? "";
    setOpen(false);
    if (ref === "member" && n.reference_id) return setProfile(n.reference_id);
    if (ref.startsWith("reward:") || ref.startsWith("weight:")) {
      return navigate(`/reports/events?month=${ref.split(":")[1]}`);
    }
    const routes: Record<string, string> = { checkin: "/checkin", plan: "/plans", batch: "/batches", member: "/members" };
    if (routes[ref]) navigate(routes[ref]);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead.mutate()}>
                <Check className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="h-80">
            {!notifications?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <div className="divide-y">
                {notifications.map((n) => {
                  const Icon = icons[n.type] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${!n.read ? "bg-muted/30" : ""}`}
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${!n.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm leading-tight ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                          {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <MemberSheetById memberId={profile} onClose={() => setProfile(null)} />
    </>
  );
}
