import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberIdentity, mobileToEmail, normalizeMobile } from "@/hooks/useMemberIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";
import { z } from "zod";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { BrandLogo } from "@/components/BrandLogo";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Name must be under 100 characters"),
});

export default function Auth() {
  const { session, loading, signOut } = useAuth();
  const { data: identity, isLoading: identityLoading } = useMemberIdentity();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const mode = params.get("mode") === "team" ? "team" : "member";
  const next = params.get("next");

  // Team / admin state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Member state
  const [mobile, setMobile] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading || (session && identityLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session && identity) {
    if (identity.isStaff) return <Navigate to={next && next.startsWith("/") ? next : "/dashboard"} replace />;
    if (identity.memberId) return <Navigate to={next && next.startsWith("/portal") ? next : "/portal"} replace />;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <BrandLogo className="mx-auto h-14 w-14" />
          <h1 className="font-display text-2xl font-semibold">No access yet</h1>
          <p className="text-sm text-muted-foreground">
            This account is signed in but is not linked to a member profile or a team role yet. Please contact the
            centre front desk to get access.
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const setMode = (value: string) => {
    const nextParams = new URLSearchParams(params);
    if (value === "team") nextParams.set("mode", "team");
    else nextParams.delete("mode");
    setParams(nextParams, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const schema = isLogin ? loginSchema : signupSchema;
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => { errs[err.path[0] as string] = err.message; });
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
      } else {
        const data = parsed.data as z.infer<typeof signupSchema>;
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: data.fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link to verify your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: sanitizeErrorMessage(error.message || "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-login");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) throw signInError;
    } catch (error: any) {
      toast({
        title: "Demo unavailable",
        description: sanitizeErrorMessage(error.message || "Could not start the demo"),
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const memberValid = normalizeMobile(mobile).length === 10 && memberPassword.length >= 8;

  const memberSignIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: mobileToEmail(mobile),
      password: memberPassword,
    });
    setBusy(false);
    if (error) {
      toast({
        title: "Sign in failed",
        description: "Check your mobile number and password, or contact the centre front desk.",
        variant: "destructive",
      });
    }
  };

  const memberFields = (idPrefix: string) => (
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
          value={memberPassword}
          onChange={(e) => setMemberPassword(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:w-1/2">
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at 25% 80%, hsl(var(--brand-gold) / 0.25), transparent 60%)" }}
        />
        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-12 w-12" />
            <span className="font-display text-xl font-semibold text-white">All In One Wellness</span>
          </div>

          <div className="space-y-6">
            <h1 className="font-display text-5xl font-semibold leading-[1.1] text-white lg:text-6xl">
              A healthier family,<br />
              one check-in at a time.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-white/70">
              Memberships, servings, check-ins and transformation milestones —
              all in one wellness centre platform.
            </p>
          </div>

          <p className="text-sm text-white/40">© 2026 All In One Wellness — Family Health Club, Shri Chatap.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-card p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo className="h-12 w-12" />
            <span className="font-display text-lg font-semibold">All In One Wellness</span>
          </div>

          <Tabs value={mode} onValueChange={setMode} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="member">Member</TabsTrigger>
              <TabsTrigger value="team">Team / Admin</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "member" ? (
            <>
              <h2 className="mb-1 font-display text-2xl font-semibold">Member sign in</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Check in with the centre QR and follow your plan.
              </p>

              <div className="space-y-4">
                {memberFields("in")}
                <Button className="w-full" disabled={!memberValid || busy} onClick={memberSignIn}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
                </Button>
                <p className="text-xs text-muted-foreground">
                  Your login is created by the centre front desk. Ask them for your password if you do not have it yet.
                </p>
              </div>

            </>
          ) : (
            <>
              <h2 className="mb-1 font-display text-2xl font-semibold">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mb-8 text-sm text-muted-foreground">
                {isLogin ? "Sign in to the centre dashboard" : "Set up your team account"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      required
                      maxLength={100}
                    />
                    {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@wellnesscentre.in"
                    required
                    maxLength={255}
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Sign in" : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>

              <Button
                variant="secondary"
                className="mb-3 w-full"
                onClick={handleDemoLogin}
                disabled={demoLoading}
              >
                {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Try demo"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (error) {
                    toast({ title: "Error", description: String(error), variant: "destructive" });
                  }
                }}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </Button>

              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </span>{" "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-medium text-primary hover:underline"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
