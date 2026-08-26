import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/** Shown when staff issued the password and the member must pick their own. */
export function PortalPasswordPrompt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const mustChange = (user?.user_metadata as { must_change_password?: boolean } | undefined)?.must_change_password;
  if (!mustChange || done) return null;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not update password", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "Password updated", description: "Use your new password next time you sign in." });
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Set your own password</CardTitle>
        <CardDescription>Your login was created by the centre team. Please choose a private password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-pw">New password</Label>
          <Input id="new-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pw">Confirm password</Label>
          <Input id="confirm-pw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full" disabled={password.length < 8 || password !== confirm || busy} onClick={save}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save password
        </Button>
      </CardContent>
    </Card>
  );
}
