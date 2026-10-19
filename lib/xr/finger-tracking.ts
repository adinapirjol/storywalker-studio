export type HandPoint = { x: number; y: number };
export function indexPointer(hands: HandPoint[][]): HandPoint | null {
  if (hands.length !== 1 || hands[0].length !== 21) return null;
  const points = hands[0];
  if (!points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const distance = (a: HandPoint, b: HandPoint) => Math.hypot(a.x - b.x, a.y - b.y);
  // Other fingers may be curled. An extended index is the sole gesture input.
  return distance(points[8], points[0]) > distance(points[6], points[0]) * 1.1 ? points[8] : null;
}
export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
];
/** Draw on the same mirrored frame submitted to inference, never on a later video frame. */
export function drawHandOverlay(canvas: HTMLCanvasElement, hands: HandPoint[][]) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const pointer = indexPointer(hands);
  ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
  ctx.lineWidth = 2; ctx.strokeStyle = hands.length === 1 ? '#70edcf' : '#f7b866';
  for (const points of hands) {
    if (points.length !== 21 || !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    for (const [a,b] of HAND_CONNECTIONS) {
      ctx.beginPath();ctx.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);
      ctx.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);ctx.stroke();
    }
    points.forEach((p,i) => {
      ctx.fillStyle = i === 8 && pointer ? '#ffe18c' : '#70edcf';
      ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,i === 8 ? 6 : 2.5,0,Math.PI*2);ctx.fill();
    });
  }
  ctx.restore();
}
