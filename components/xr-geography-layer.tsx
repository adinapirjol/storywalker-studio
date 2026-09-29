"use client";
import { useEffect, useMemo, useState } from "react";
import { basemapInRoom, polygonPath, type BasemapData, type GeographicProjection } from "@/lib/journey-basemap";
import { projectRoom, type JourneyCamera } from "@/lib/journey-camera";

export function XRGeographyLayer({ projection, camera }: { projection: GeographicProjection; camera: JourneyCamera }) {
  const [data, setData] = useState<BasemapData | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/maps/natural-earth.json", { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error("Basemap unavailable"); return response.json();
    }).then(setData).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, []);
  const map = useMemo(() => data ? basemapInRoom(data, projection) : null, [data, projection]);
  if (!map) return <text x="18" y="25" fill="#c9d3cd" fontSize="13">{failed ? "Basemap unavailable; geographic stops remain visible." : "Loading local basemap…"}</text>;
  const occupied: { x: number; y: number; width: number }[] = [];
  const labels = [
    ...map.cities.map(c => ({ name: c.name, position: c.position, country: false })),
    ...map.countries.map(c => ({ name: c.name.toUpperCase(), position: c.label, country: true })),
  ].flatMap(label => {
    const p = projectRoom(label.position, camera), width = label.name.length * 6;
    if (Math.abs(label.position.x) > 20 || Math.abs(label.position.z) > 20 || p.depth < .2 || p.x < 20 || p.x + width > 790 || p.y < 25 || p.y > 575) return [];
    if (occupied.some(other => Math.abs(other.y - p.y) < 20 && p.x < other.x + other.width + 10 && p.x + width + 10 > other.x)) return [];
    occupied.push({ x: p.x, y: p.y, width }); return [{ ...label, ...p }];
  });
  return <g aria-label="Natural Earth geographic basemap" pointerEvents="none">
    {map.countries.map(country => <path key={country.name} d={country.rings.map(ring => polygonPath(ring, camera)).join(" ")} fill="#30473f" fillOpacity=".8" fillRule="evenodd" stroke="#94b4a3" strokeOpacity=".55" strokeWidth=".8"><title>{country.name} · Natural Earth geographic reference</title></path>)}
    {labels.map((label, i) => <g key={`${label.name}-${i}`}><text x={label.x} y={label.y} fill={label.country ? "#a2bca8" : "#d1dfd8"} fontSize={label.country ? 11 : 12} paintOrder="stroke" stroke="#15231f" strokeWidth="3">{label.name}</text>{!label.country && <circle cx={label.x - 4} cy={label.y - 3} r="1.5" fill="#d1dfd8"/>}</g>)}
  </g>;
}
