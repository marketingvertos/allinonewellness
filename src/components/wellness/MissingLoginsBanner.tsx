import { useCreateMissingLogins, useMembersWithoutLogin } from "@/hooks/useMemberAccess";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";
import { DEFAULT_MEMBER_PASSWORD } from "@/lib/memberAccess";

/** Warns the team when members exist without a portal login and fixes them in one click. */
export function MissingLoginsBanner() {
  const { data: pending, isLoading } = useMembersWithoutLogin();
  const create = useCreateMissingLogins();

  if (isLoading || !pending?.length) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4 text-primary" />
          {pending.length} member{pending.length === 1 ? "" : "s"} cannot sign in yet
        </p>
        <p className="break-words text-sm text-muted-foreground">
          {pending.slice(0, 4).map((m) => `${m.full_name} (${m.mobile_number})`).join(", ")}
          {pending.length > 4 ? ` and ${pending.length - 4} more` : ""} — create their portal logins with the default
          password {DEFAULT_MEMBER_PASSWORD}.
        </p>
      </div>
      <Button className="shrink-0" onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create missing logins
      </Button>
    </div>
  );
}
