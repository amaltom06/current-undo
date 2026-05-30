import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Haversine distance in meters
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function statusFor(reports: number) {
  if (reports >= 5) return "verified";
  if (reports >= 3) return "likely";
  return "unverified";
}

const coordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  areaName: z.string().max(120).optional(),
  ksebSection: z.string().max(120).optional(),
});

const CLUSTER_RADIUS_M = 500;

export const reportOutage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => coordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Find nearby active outage
    const { data: actives, error: aErr } = await supabaseAdmin
      .from("outages")
      .select("*")
      .is("restored_at", null);
    if (aErr) throw new Error(aErr.message);

    const nearby = (actives ?? []).find(
      (o) => distMeters({ lat: o.lat, lng: o.lng }, data) <= CLUSTER_RADIUS_M,
    );

    if (nearby) {
      // Insert report (dedupe by unique constraint)
      const { error: rErr } = await supabaseAdmin.from("outage_reports").insert({
        outage_id: nearby.id,
        user_id: userId,
        report_type: "outage",
        lat: data.lat,
        lng: data.lng,
      });
      if (rErr && !rErr.message.includes("duplicate")) throw new Error(rErr.message);

      const { count } = await supabaseAdmin
        .from("outage_reports")
        .select("*", { count: "exact", head: true })
        .eq("outage_id", nearby.id)
        .eq("report_type", "outage");

      const reports = count ?? nearby.report_count;
      await supabaseAdmin
        .from("outages")
        .update({
          report_count: reports,
          status: statusFor(reports),
          area_name: data.areaName ?? nearby.area_name,
          kseb_section: data.ksebSection ?? nearby.kseb_section,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nearby.id);

      return { outageId: nearby.id, reportCount: reports, status: statusFor(reports) };
    }

    // Create new outage
    const { data: created, error: cErr } = await supabaseAdmin
      .from("outages")
      .insert({
        lat: data.lat,
        lng: data.lng,
        area_name: data.areaName ?? null,
        kseb_section: data.ksebSection ?? null,
        created_by: userId,
        report_count: 1,
        status: "unverified",
      })
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);

    await supabaseAdmin.from("outage_reports").insert({
      outage_id: created.id,
      user_id: userId,
      report_type: "outage",
      lat: data.lat,
      lng: data.lng,
    });

    return { outageId: created.id, reportCount: 1, status: "unverified" };
  });

export const reportRestored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => coordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: actives, error: aErr } = await supabaseAdmin
      .from("outages")
      .select("*")
      .is("restored_at", null);
    if (aErr) throw new Error(aErr.message);

    const nearby = (actives ?? []).find(
      (o) => distMeters({ lat: o.lat, lng: o.lng }, data) <= CLUSTER_RADIUS_M,
    );
    if (!nearby) return { restored: false };

    await supabaseAdmin.from("outage_reports").insert({
      outage_id: nearby.id,
      user_id: userId,
      report_type: "restored",
      lat: data.lat,
      lng: data.lng,
    });

    const { count } = await supabaseAdmin
      .from("outage_reports")
      .select("*", { count: "exact", head: true })
      .eq("outage_id", nearby.id)
      .eq("report_type", "restored");

    const restored = count ?? 1;
    // Close after 2 restoration reports (or solo if outage was unverified)
    const shouldClose = restored >= 2 || nearby.report_count <= 1;

    const update: Record<string, unknown> = {
      restored_count: restored,
      updated_at: new Date().toISOString(),
    };
    if (shouldClose) {
      update.restored_at = new Date().toISOString();
      update.status = "restored";
    }
    await supabaseAdmin.from("outages").update(update).eq("id", nearby.id);

    const durationMs = Date.now() - new Date(nearby.started_at).getTime();
    return { restored: true, closed: shouldClose, durationMs };
  });

export const getActiveOutages = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("outages")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});