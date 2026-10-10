import type { JourneyEpisode } from "./journey-episode";
export type GeoPoint = { latitude: number; longitude: number };
export type GlobeCamera = GeoPoint & { zoom: number };
export type SpherePoint = { x: number; y: number; z: number };
export const GLOBE_CAMERA: GlobeCamera = { latitude: 48, longitude: 10, zoom: 1 };
export const GLOBE_RADIUS = 245;
const rad = Math.PI / 180;
export function spherePoint(point: GeoPoint): SpherePoint {
  const lat = point.latitude * rad, lon = point.longitude * rad;
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}
export function globeRotation(camera: GlobeCamera) {
  const a = camera.longitude * rad, b = camera.latitude * rad;
  return [Math.cos(a), -Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b),
    0, Math.cos(b), Math.sin(b), -Math.sin(a), -Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)];
}
export function projectSphere(point: SpherePoint, camera: GlobeCamera) {
  const m = globeRotation(camera), right = m[0] * point.x + m[3] * point.y + m[6] * point.z;
  const up = m[1] * point.x + m[4] * point.y + m[7] * point.z;
  const depth = m[2] * point.x + m[5] * point.y + m[8] * point.z;
  return { x: 400 + right * GLOBE_RADIUS * camera.zoom, y: 300 - up * GLOBE_RADIUS * camera.zoom, depth };
}
export function globeZoom(camera: GlobeCamera, delta: number): GlobeCamera {
  return { ...camera, zoom: Math.max(1, Math.min(24, camera.zoom * Math.exp(-Math.max(-300, Math.min(300, delta)) * .0015))) };
}
export function globeTurn(camera: GlobeCamera, dx: number, dy: number): GlobeCamera {
  return { ...camera, longitude: ((camera.longitude - dx * .25 / camera.zoom + 180) % 360 + 360) % 360 - 180,
    latitude: Math.max(-89.9, Math.min(89.9, camera.latitude + dy * .25 / camera.zoom)) };
}
/** Read independently sourced geography, never MEMORY positions or contextual labels. */
export function episodeGeography(episode: JourneyEpisode): GeoPoint | null {
  for (const id of episode.worldPosition?.evidenceIds ?? []) {
    const node = episode.provenance.nodes.find(node => node.id === id);
    if (node?.type === "timeline") return node.coordinates;
    if (node?.type === "author" && node.confirmedGeography) return node.confirmedGeography;
  }
  return null;
}
/** Unit-sphere interpolation; its arc indicates chronological linkage, not a measured route. */
export function sphereArc(a: SpherePoint, b: SpherePoint): SpherePoint[] {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)), angle = Math.acos(dot);
  if (angle < 1e-8) return [a, b];
  // An antipodal route is ambiguous: do not choose an arbitrary direction.
  if (Math.PI - angle < 1e-6) return [];
  const steps = Math.max(2, Math.ceil(angle / (2 * rad)));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = Math.sin((1 - t) * angle) / Math.sin(angle), v = Math.sin(t * angle) / Math.sin(angle);
    return { x: u * a.x + v * b.x, y: u * a.y + v * b.y, z: u * a.z + v * b.z };
  });
}
export function visibleArcPath(points: SpherePoint[], camera: GlobeCamera) {
  let path = "", pen = false;
  for (const point of points) {
    const p = projectSphere(point, camera);
    if (p.depth < 0) { pen = false; continue; }
    path += `${pen ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)} `; pen = true;
  }
  return path;
}
