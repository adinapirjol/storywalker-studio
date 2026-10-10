/** Perspective camera only. Geographic room coordinates are never rewritten. */
export type RoomPoint = { x: number; z: number };
export type JourneyCamera = { yaw: number; elevation: number; distance: number; target: RoomPoint };
export const INITIAL_CAMERA: JourneyCamera = { yaw: 0, elevation: Math.PI / 3, distance: 64, target: { x: 0, z: 0 } };
export const VIEW = { width: 800, height: 600, focal: 650 };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function projectRoom(point: RoomPoint, camera: JourneyCamera, y = 0) {
  const x = point.x - camera.target.x, z = point.z - camera.target.z;
  const right = x * Math.cos(camera.yaw) - z * Math.sin(camera.yaw);
  const forward = x * Math.sin(camera.yaw) + z * Math.cos(camera.yaw);
  const up = y * Math.cos(camera.elevation) - forward * Math.sin(camera.elevation);
  const depth = camera.distance - forward * Math.cos(camera.elevation) - y * Math.sin(camera.elevation);
  const scale = VIEW.focal / Math.max(.1, depth);
  return { x: VIEW.width / 2 + right * scale, y: VIEW.height / 2 - up * scale, depth, scale };
}

/** Ray/ground-plane intersection for dragging at any permitted camera angle. */
export function unprojectRoom(screen: { x: number; y: number }, camera: JourneyCamera): RoomPoint | null {
  const vertical = (screen.y - VIEW.height / 2) / VIEW.focal;
  const denominator = Math.sin(camera.elevation) + vertical * Math.cos(camera.elevation);
  if (denominator <= .001) return null;
  const forward = vertical * camera.distance / denominator;
  const depth = camera.distance - forward * Math.cos(camera.elevation);
  if (depth <= .1) return null;
  const right = (screen.x - VIEW.width / 2) / VIEW.focal * depth;
  return { x: camera.target.x + right * Math.cos(camera.yaw) + forward * Math.sin(camera.yaw),
    z: camera.target.z - right * Math.sin(camera.yaw) + forward * Math.cos(camera.yaw) };
}

export function zoomCamera(camera: JourneyCamera, delta: number): JourneyCamera {
  return { ...camera, distance: clamp(camera.distance * Math.exp(clamp(delta, -300, 300) * .0015), 3, 140) };
}

/** Clip crossing lines so close inspection doesn't invert or erase the route. */
export function projectSegment(a: RoomPoint, b: RoomPoint, camera: JourneyCamera) {
  let from = projectRoom(a, camera), to = projectRoom(b, camera);
  const near = .2;
  if (from.depth < near && to.depth < near) return null;
  const mix = (t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  if (from.depth < near) from = projectRoom(mix((near - from.depth) / (to.depth - from.depth)), camera);
  if (to.depth < near) to = projectRoom(mix((projectRoom(a, camera).depth - near) / (projectRoom(a, camera).depth - to.depth)), camera);
  return { from, to };
}
