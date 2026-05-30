import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </span>
          <span>Current Undo?</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="rounded px-2 py-1 hover:bg-secondary" activeProps={{ className: "rounded px-2 py-1 bg-secondary font-medium" }} activeOptions={{ exact: true }}>Report</Link>
          <Link to="/map" className="rounded px-2 py-1 hover:bg-secondary" activeProps={{ className: "rounded px-2 py-1 bg-secondary font-medium" }}>Map</Link>
          <Link to="/feed" className="rounded px-2 py-1 hover:bg-secondary" activeProps={{ className: "rounded px-2 py-1 bg-secondary font-medium" }}>Feed</Link>
          {!loading && (
            user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="ml-2 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
              >Sign out</button>
            ) : (
              <Link to="/login" className="ml-2 rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background">Sign in</Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}