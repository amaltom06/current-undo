import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { getActiveOutages } from "@/lib/outages.functions";
import { supabase } from "@/integrations/supabase/client";

const OutageMap = lazy(() => import("@/components/OutageMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Outage Map — Current Undo?" },
      { name: "description", content: "Live map of reported power outages across Kerala." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const q = useQuery({
    queryKey: ["map-outages"],
    queryFn: () => getActiveOutages(),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("map-outages-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "outages" }, () =>
        qc.invalidateQueries({ queryKey: ["map-outages"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const outages = q.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live outage map</h1>
          <p className="text-sm text-muted-foreground">{outages.length} report cluster(s)</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Legend color="#dc2626" label="Verified" />
          <Legend color="#f59e0b" label="Likely" />
          <Legend color="#94a3b8" label="Unverified" />
          <Legend color="#16a34a" label="Restored" />
        </div>
      </div>
      <div className="h-[70vh] overflow-hidden rounded-2xl border bg-card">
        {mounted ? (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
            <OutageMap outages={outages} />
          </Suspense>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>
        )}
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}