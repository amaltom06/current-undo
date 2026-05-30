import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Current Undo?" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { toast.error(res.error.message); setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Zap className="h-6 w-6" />
      </div>
      <h1 className="text-center text-2xl font-bold tracking-tight">Welcome to Current Undo?</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Sign in to report and track outages" : "Create an account"}
      </p>

      <button
        onClick={google}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          required type="email" placeholder="Email"
          className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required type="password" placeholder="Password" minLength={6}
          className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit" disabled={busy}
          className="flex w-full items-center justify-center rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? "Sign in" : "Create account")}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 w-full text-center text-xs text-muted-foreground underline"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}