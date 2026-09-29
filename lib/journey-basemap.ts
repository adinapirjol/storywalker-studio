import type { RoomPoint, JourneyCamera } from "./journey-camera";
import { projectRoom } from "./journey-camera";
export type GeographicProjection = { originLatitude: number; originLongitude: number; metresPerUnit: number };
export type BasemapData = { version: number; attribution: string; sources: { url: string; sha256: string }[];
  countries: { name: string; label: number[]; polygons: number[][][][] }[];
  cities: { name: string; coordinates: number[]; rank: number }[] };

/** Same radius, longitude wrapping, north axis and uniform scale as groundJourney. */
export function geographicToRoom(longitude: number, latitude: number, projection: GeographicProjection): RoomPoint {
  const delta = ((longitude - projection.originLongitude + 180) % 360 + 360) % 360 - 180;
  const metres = 6371008.8 * Math.PI / 180;
  return { x: delta * metres * Math.max(1e-6, Math.cos(projection.originLatitude * Math.PI / 180)) / projection.metresPerUnit,
    z: -(latitude - projection.originLatitude) * metres / projection.metresPerUnit };
}

/** Sutherland-Hodgman clipping, also used for the camera near plane. */
export function clipPolygon(input: RoomPoint[], distance: (p: RoomPoint) => number) {
  if (!input.length) return [];
  const output: RoomPoint[] = [];
  for (let i = 0; i < input.length; i++) {
    const a = input[(i + input.length - 1) % input.length], b = input[i], da = distance(a), db = distance(b);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db); output.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
    }
    if (db >= 0) output.push(b);
  }
  return output;
}
export function clipToRoom(points: RoomPoint[]) {
  for (const distance of [(p: RoomPoint) => p.x + 20, (p: RoomPoint) => 20 - p.x, (p: RoomPoint) => p.z + 20, (p: RoomPoint) => 20 - p.z]) points = clipPolygon(points, distance);
  return points;
}
export function basemapInRoom(data: BasemapData, projection: GeographicProjection) {
  const project = (p: number[]) => geographicToRoom(p[0], p[1], projection);
  const inside = (p: RoomPoint) => Math.abs(p.x) <= 20 && Math.abs(p.z) <= 20;
  return {
    countries: data.countries.map(country => ({ name: country.name, label: project(country.label),
      rings: country.polygons.flatMap(polygon => polygon.map(ring => {
        const points = ring.map(project);
        // Do not connect across the wrapped world seam (outside this local map).
        if (ring.some((_, i) => Math.abs(points[i].x - points[(i + 1) % points.length].x) * projection.metresPerUnit > 20000000)) return [];
        return clipToRoom(points);
      })).filter(ring => ring.length >= 3),
    })).filter(country => country.rings.length),
    cities: data.cities.map(city => ({ ...city, position: project(city.coordinates) })).filter(city => inside(city.position)).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
  };
}
export function polygonPath(points: RoomPoint[], camera: JourneyCamera) {
  const clipped = clipPolygon(points, p => projectRoom(p, camera).depth - .2);
  return clipped.length < 3 ? "" : clipped.map(p => projectRoom(p, camera)).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
}

/** Existing intervals only; no interpolation or claims of presence during gaps. */
export function journeyAtTime(episodes: { start: string; end: string; reconstructedTiming?: { listeningWindows: { start: string; end: string }[] } }[], at: number | null) {
  const visible = episodes.map(episode => at === null || Date.parse(episode.start) <= at);
  const active = episodes.map(episode => at !== null && Date.parse(episode.start) <= at && at < Date.parse(episode.end) && (!episode.reconstructedTiming || episode.reconstructedTiming.listeningWindows.some(window => Date.parse(window.start) <= at && at < Date.parse(window.end))));
  let latest = -1;
  visible.forEach((yes, index) => { if (yes) latest = index; });
  return { visible, active, latest, count: visible.filter(Boolean).length, activeCount: active.filter(Boolean).length };
}
