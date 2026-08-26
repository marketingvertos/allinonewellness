import { useState } from "react";
import { useManageMemberLogin, useMemberAccessStatus } from "@/hooks/useMemberAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, Loader2 } from "lucide-react";

interface Props {
  memberId: string;
  mobileNumber: string;
  /** Compact variant used inside the create-member flow. */
  autoFocusCreate?: boolean;
}

export function MemberLoginCard({ memberId, mobileNumber }: Props) {
  const { data: status, isLoading } = useMemberAccessStatus(memberId);
  const manage = useManageMemberLogin();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState<{ loginId: string; password: string } | null>(null);

  const run = async (action: "create" | "reset" | "unlink") => {
    const result = await manage.mutateAsync({ memberId, action, password: password || undefined });
    setPassword("");
    if (action === "unlink") setIssued(null);
    else setIssued({ loginId: result.loginId, password: result.password });
  };

  const copy = () => {
    if (!issued) return;
    navigator.clipboard.writeText(
      `Login ID: ${issued.loginId}\nMobile: ${mobileNumber}\nPassword: ${issued.password}\nPortal: ${window.location.origin}/portal/auth`,
    );
    toast({ title: "Credentials copied" });
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <p className="font-medium">Member portal login</p>
        {!isLoading && (
          <Badge variant={status?.hasLogin ? "secondary" : "outline"}>
            {status?.hasLogin ? "Active" : "Not created"}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        The member signs in at <span className="font-mono">/portal/auth</span> with their mobile number{" "}
        <span className="font-mono">{mobileNumber}</span>. They are asked to set their own password on first sign in.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`pw-${memberId}`}>Password (leave blank to auto-generate)</Label>
        <Input
          id={`pw-${memberId}`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {status?.hasLogin ? (
          <>
            <Button size="sm" onClick={() => run("reset")} disabled={manage.isPending}>
              {manage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset password
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("unlink")} disabled={manage.isPending}>
              Remove access
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => run("create")} disabled={manage.isPending}>
            {manage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create login
          </Button>
        )}
      </div>

      {issued && (
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Share these details with the member now — the password is shown only once.</p>
          <p className="mt-2 font-mono text-sm">Mobile: {mobileNumber}</p>
          <p className="font-mono text-sm">Password: {issued.password}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" /> Copy credentials
          </Button>
        </div>
      )}
    </div>
  );
}
