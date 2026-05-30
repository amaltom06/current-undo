import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { getActiveOutages } from "@/lib/outages.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Live Outage Feed — Current Undo?" },
      { name: "description", content: "Live community updates on Kerala power outages and restorations." },
    ],
  }),
  component: Feed,
});

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Feed() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["feed"],
    queryFn: () => getActiveOutages(),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("feed-outages")
      .on("postgres_changes", { event: "*", schema: "public", table: "outages" }, () =>
        qc.invalidateQueries({ queryKey: ["feed"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data ?? [];

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Live feed</h1>
      <p className="mb-6 text-sm text-muted-foreground">Latest reports from across Kerala.</p>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && items.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No outages reported yet. Be the first to report one.
        </div>
      )}
      <ul className="space-y-3">
        {items.map((o) => {
          const restored = !!o.restored_at;
          return (
            <li key={o.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${restored ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
                  {restored ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">
                      {restored ? "Power restored" : "Power outage reported"}
                      {o.area_name ? ` · ${o.area_name}` : ""}
                    </p>
                    <span className="text-xs text-muted-foreground">{timeAgo(restored ? o.restored_at! : o.started_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.kseb_section ? `KSEB ${o.kseb_section} · ` : ""}
                    {o.report_count} report{o.report_count === 1 ? "" : "s"} · status: {o.status}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}