import type { WalkCamera } from './spatial-projection';
export type HeadPosition = { x: number; y: number };
export const NEUTRAL_HEAD: HeadPosition = { x: 0, y: 0 };
const bound = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
/** A temporary viewing camera. Never pass this to movement or evidence decisions. */
export function headPerspective(camera: WalkCamera, head: HeadPosition, strength = .6): WalkCamera {
  const range = Math.max(0, Math.min(.9, strength));
  const x = bound(head.x) * range, y = bound(head.y) * range;
  return { ...camera, x: camera.x + Math.cos(camera.yaw) * x,
    z: camera.z + Math.sin(camera.yaw) * x, eye: camera.eye + y,
    projectionShift: { x: x / 4, y: -y / 4 } };
}
export function relativeHead(face: HeadPosition, origin: HeadPosition): HeadPosition {
  // Front camera image is unmirrored: image-left corresponds to viewer-right.
  return { x: bound((origin.x - face.x) * 5), y: bound((origin.y - face.y) * 5) };
}
