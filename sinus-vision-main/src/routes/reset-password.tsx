import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password · SinusAI" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase places the recovery token in the URL hash and creates a session.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <form
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-clinical)]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 6) return toast.error("Password must be at least 6 characters");
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          navigate({ to: "/dashboard", replace: true });
        }}
      >
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          {ready ? "Choose a strong password to continue." : "Waiting for recovery link…"}
        </p>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} />
        </div>
        <Button type="submit" className="w-full" disabled={!ready || busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
        </Button>
      </form>
    </div>
  );
}
