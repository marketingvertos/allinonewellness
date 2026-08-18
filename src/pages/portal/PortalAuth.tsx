import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mobileToEmail, normalizeMobile } from "@/hooks/useMemberIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { HeartPulse, Loader2 } from "lucide-react";

export default function PortalAuth() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const { toast } = useToast();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to={next || "/portal"} replace />;

  const valid = normalizeMobile(mobile).length === 10 && password.length >= 8;

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: mobileToEmail(mobile),
      password,
    });
    setBusy(false);
    if (error) {
      toast({
        title: "Sign in failed",
        description: "Check your mobile number and password, or activate your account first.",
        variant: "destructive",
      });
    }
  };

  const activate = async () => {
    setBusy(true);
    try {
      const digits = normalizeMobile(mobile);
      const { error } = await supabase.auth.signUp({
        email: mobileToEmail(mobile),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { account_type: "wellness_member", mobile_number: digits },
        },
      });
      if (error) throw error;

      // The database links this login to the member record created at the centre.
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: member } = await supabase
          .from("wellness_members")
          .select("id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (!member) {
          await supabase.auth.signOut();
          toast({
            title: "We could not find your membership",
            description: "Please ask the front desk to register this mobile number first.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({ title: "Account activated", description: "You are signed in." });
    } catch (error) {
      toast({
        title: "Activation failed",
        description: sanitizeErrorMessage((error as { message?: string })?.message ?? ""),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const fields = (idPrefix: string) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-mobile`}>Mobile number</Label>
        <div className="flex items-center gap-2">
          <span className="rounded-md border px-3 py-2 text-sm text-muted-foreground">+91</span>
          <Input
            id={`${idPrefix}-mobile`}
            inputMode="numeric"
            maxLength={13}
            placeholder="98XXXXXXXX"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <HeartPulse className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Member portal</CardTitle>
          <CardDescription>Check in with the centre QR and follow your plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="activate">Activate account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 pt-4">
              {fields("in")}
              <Button className="w-full" disabled={!valid || busy} onClick={signIn}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
              </Button>
            </TabsContent>
            <TabsContent value="activate" className="space-y-4 pt-4">
              {fields("up")}
              <p className="text-xs text-muted-foreground">
                Use the mobile number you gave at the centre. If it is not registered yet, please ask the front desk.
              </p>
              <Button className="w-full" disabled={!valid || busy} onClick={activate}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Activate
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
