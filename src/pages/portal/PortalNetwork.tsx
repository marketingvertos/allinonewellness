import { Link } from "react-router-dom";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { NetworkPanel } from "@/components/wellness/NetworkPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PortalNetwork() {
  const { data: identity } = useMemberIdentity();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold">My network</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/portal">
            <ArrowLeft className="mr-2 h-4 w-4" /> My plan
          </Link>
        </Button>
      </div>
      {identity?.memberId ? (
        <NetworkPanel memberId={identity.memberId} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading your network…</p>
      )}
    </div>
  );
}
