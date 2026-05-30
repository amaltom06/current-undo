import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, CheckCircle2, MapPin, Loader2 } from "lucide-react";
import {
  reportOutage,
  reportRestored,
  getActiveOutages,
} from "@/lib/outages.functions";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Report Power Outage — Current Undo?" },
      { name: "description", content: "Tap to report when power goes out or comes back in your area in Kerala." },
    ],
  }),
  component: Index,
});

type Coords = { lat: number; lng: number };

function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function statusColor(status: string) {
  if (status === "verified") return "bg-primary text-primary-foreground";
  if (status === "likely") return "bg-warning text-warning-foreground";
  if (status === "restored") return "bg-success text-success-foreground";
  return "bg-secondary text-secondary-foreground";
}

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [coords, setCoords] = useState<Coords | null>(null);

  const outagesQ = useQuery({
    queryKey: ["active-outages"],
    queryFn: () => getActiveOutages(),
    refetchInterval: 30000,
  });

  // Realtime invalidation
  useEffect(() => {
    const ch = supabase
      .channel("idx-outages")
      .on("postgres_changes", { event: "*", schema: "public", table: "outages" }, () => {
        qc.invalidateQueries({ queryKey: ["active-outages"] });
        qc.invalidateQueries({ queryKey: ["feed"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const reportFn = useServerFn(reportOutage);
  const restoreFn = useServerFn(reportRestored);

  const outageMut = useMutation({
    mutationFn: async () => {
      const c = await getPosition();
      setCoords(c);
      return reportFn({ data: c });
    },
    onSuccess: (res) => {
      toast.success("Outage reported", { description: `Status: ${res.status} · ${res.reportCount} report(s)` });
      qc.invalidateQueries({ queryKey: ["active-outages"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not report outage"),
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      const c = await getPosition();
      setCoords(c);
      return restoreFn({ data: c });
    },
    onSuccess: (res) => {
      if (!res.restored) toast("No nearby outage to mark restored");
      else if (res.closed) toast.success("Power restored 🎉", { description: `Outage duration: ${fmtDuration(res.durationMs!)}` });
      else toast.success("Restoration noted");
      qc.invalidateQueries({ queryKey: ["active-outages"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not report"),
  });

  const nearestActive = (() => {
    if (!coords || !outagesQ.data) return null;
    const active = outagesQ.data.filter((o) => !o.restored_at);
    if (active.length === 0) return null;
    const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
    let best = active[0], bestD = Infinity;
    for (const o of active) {
      const dLat = toRad(o.lat - coords.lat), dLng = toRad(o.lng - coords.lng);
      const s = Math.sin(dLat/2)**2 + Math.cos(toRad(coords.lat))*Math.cos(toRad(o.lat))*Math.sin(dLng/2)**2;
      const d = 2*R*Math.asin(Math.sqrt(s));
      if (d < bestD) { bestD = d; best = o; }
    }
    return { outage: best, distanceM: bestD };
  })();

  if (!loading && !user) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Zap className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Current Undo?</h1>
        <p className="mt-2 text-muted-foreground">
          Kerala's community power-outage tracker. Sign in to report outages.
        </p>
        <button
          onClick={() => navigate({ to: "/login" })}
          className="mt-6 w-full rounded-xl bg-foreground py-3 font-semibold text-background"
        >
          Sign in to continue
        </button>
        <Link to="/map" className="mt-3 inline-block text-sm text-muted-foreground underline">
          Browse the live map as a guest →
        </Link>
      </main>
    );
  }

  const activeCount = (outagesQ.data ?? []).filter((o) => !o.restored_at).length;

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hey there 👋</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount > 0 ? `${activeCount} active outage${activeCount === 1 ? "" : "s"} across Kerala` : "All clear across Kerala right now"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          disabled={outageMut.isPending}
          onClick={() => outageMut.mutate()}
          className="group relative w-full overflow-hidden rounded-2xl bg-primary p-6 text-left text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98] disabled:opacity-70"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/15">
              {outageMut.isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <Zap className="h-7 w-7" />}
            </div>
            <div>
              <div className="text-xl font-bold">⚡ Current Poyi</div>
              <div className="text-sm opacity-90">Tap if power just went out</div>
            </div>
          </div>
        </button>

        <button
          disabled={restoreMut.isPending}
          onClick={() => restoreMut.mutate()}
          className="group relative w-full overflow-hidden rounded-2xl bg-success p-6 text-left text-success-foreground shadow-lg shadow-success/20 transition active:scale-[0.98] disabled:opacity-70"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/15">
              {restoreMut.isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <CheckCircle2 className="h-7 w-7" />}
            </div>
            <div>
              <div className="text-xl font-bold">✅ Current Vannu</div>
              <div className="text-sm opacity-90">Tap when power comes back</div>
            </div>
          </div>
        </button>
      </div>

      {nearestActive && nearestActive.distanceM < 5000 && (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              Nearby outage
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(nearestActive.outage.status)}`}>
              {nearestActive.outage.status}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {(nearestActive.distanceM / 1000).toFixed(2)} km away · {nearestActive.outage.report_count} reports · started{" "}
            {fmtDuration(Date.now() - new Date(nearestActive.outage.started_at).getTime())} ago
          </div>
        </div>
      )}

      <Link
        to="/map"
        className="mt-6 block rounded-xl border bg-card p-4 text-center text-sm font-medium hover:bg-secondary"
      >
        View live outage map →
      </Link>
    </main>
  );
}
