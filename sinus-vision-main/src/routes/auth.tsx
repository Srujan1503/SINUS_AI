import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";

const search = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Sign in · SinusAI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const sp = useSearch({ from: "/auth" });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Brain className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">SinusAI</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Clinical AI for paranasal sinus CT, built for radiologists.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Segment, grade severity, and generate clinician-ready reports — backed by
            SwinUNETR and a Vision Transformer.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">
          Research prototype. Not a substitute for professional medical judgment.
        </div>
      </div>

      <div className="grid place-items-center px-6 py-10">
        <div className="w-full max-w-md">
          <Tabs defaultValue={sp.mode === "signup" ? "signup" : sp.mode === "forgot" ? "forgot" : "signin"}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
              <TabsTrigger value="forgot">Forgot</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInForm onSuccess={() => navigate({ to: sp.redirect ?? "/dashboard", replace: true })} />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm />
            </TabsContent>
            <TabsContent value="forgot">
              <ForgotForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin + "/dashboard",
        });
        if (result.error) {
          toast.error(result.error.message ?? "Google sign-in failed");
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.92h5.46c-.24 1.4-1.7 4.12-5.46 4.12-3.28 0-5.96-2.72-5.96-6.06s2.68-6.06 5.96-6.06c1.86 0 3.12.8 3.84 1.48l2.62-2.52C16.78 3.6 14.62 2.6 12 2.6 6.86 2.6 2.74 6.72 2.74 12s4.12 9.4 9.26 9.4c5.34 0 8.88-3.76 8.88-9.06 0-.6-.06-1.06-.14-1.52H12z"/></svg>
      )}
      Continue with Google
    </Button>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success("Welcome back");
        onSuccess();
      }}
    >
      <GoogleButton />
      <Divider />
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 6) return toast.error("Password must be at least 6 characters");
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success("Account created. Check your email if confirmation is required.");
      }}
    >
      <GoogleButton />
      <Divider />
      <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Password"><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
      </Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        setBusy(false);
        if (error) return toast.error(error.message);
        toast.success("Password reset link sent — check your inbox.");
      }}
    >
      <p className="text-sm text-muted-foreground">
        Enter your email and we'll send you a reset link.
      </p>
      <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
    </div>
  );
}
