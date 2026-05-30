import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

type Outage = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  area_name: string | null;
  kseb_section: string | null;
  report_count: number;
  started_at: string;
  restored_at: string | null;
};

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points as [number, number][], { padding: [30, 30], maxZoom: 13 });
    }
  }, [points, map]);
  return null;
}

function colorFor(status: string, restored: boolean) {
  if (restored) return "#16a34a";
  if (status === "verified") return "#dc2626";
  if (status === "likely") return "#f59e0b";
  return "#94a3b8";
}

export default function OutageMap({ outages }: { outages: Outage[] }) {
  const center: LatLngExpression = [10.0, 76.3]; // Kerala
  const pts: LatLngExpression[] = outages.map((o) => [o.lat, o.lng]);

  return (
    <MapContainer
      center={center}
      zoom={9}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {outages.map((o) => {
        const restored = !!o.restored_at;
        const color = colorFor(o.status, restored);
        return (
          <CircleMarker
            key={o.id}
            center={[o.lat, o.lng]}
            radius={Math.min(8 + o.report_count, 22)}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">
                  {o.area_name ?? "Unnamed area"}
                </div>
                <div>Status: {restored ? "restored" : o.status}</div>
                <div>{o.report_count} report(s)</div>
                {o.kseb_section && <div>KSEB: {o.kseb_section}</div>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      <FitBounds points={pts} />
    </MapContainer>
  );
}