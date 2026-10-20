import { unit, type SoundShape } from './sound-shape';

/** A compositional object in the existing room; no evidence or health encoding. */
export function drawSoundRibbon(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  shape: SoundShape, ambient: number, seconds: number, reducedMotion: boolean,
) {
  const stretch = unit(shape.stretch), fold = unit(shape.fold), ripple = unit(ambient);
  const time = reducedMotion ? 0 : seconds;
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, width * 0.7);
  background.addColorStop(0, '#183039'); background.addColorStop(0.6, '#0b1b24'); background.addColorStop(1, '#080f17');
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  const horizon = height * 0.69;
  ctx.strokeStyle = '#6b98981c'; ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(width / 2 + i * 18, horizon);
    ctx.lineTo(width / 2 + i * width * 0.15, height); ctx.stroke();
  }
  for (let i = 1; i <= 8; i++) {
    const y = horizon + (height - horizon) * (i / 8) ** 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  const span = width * (0.38 + stretch * 0.4), depth = height * (0.06 + fold * 0.15);
  const point = (t: number, edge: number) => {
    const envelope = Math.sin(t * Math.PI);
    const twist = t * Math.PI * (1 + fold * 3.5) + time * 0.12;
    const wave = Math.sin(t * 27 - time * 3) * ripple * height * 0.035 * envelope;
    return {
      x: width / 2 + (t - 0.5) * span + Math.sin(twist) * fold * width * 0.04,
      y: height * 0.42 + Math.sin(twist) * depth + edge * Math.cos(twist) * height * 0.065 + wave,
    };
  };
  // A fixed mesh bounds drawing work independently of capture frame rate.
  for (let band = 0; band < 18; band++) {
    const edge = band / 17 * 2 - 1;
    ctx.beginPath();
    for (let step = 0; step <= 90; step++) {
      const p = point(step / 90, edge);
      if (!step) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = band % 3 === 0 ? '#f1bc82b8' : '#8ce9cf80';
    ctx.lineWidth = band % 3 === 0 ? 1.5 : 0.8;
    ctx.stroke();
  }
  ctx.strokeStyle = '#b1dfd735'; ctx.lineWidth = 0.7;
  for (let step = 0; step <= 36; step++) {
    const a = point(step / 36, -1), b = point(step / 36, 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const t of [0, 1]) {
    const p = point(t, 0);
    ctx.fillStyle = '#c8f3df'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8f3df44'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.stroke();
  }
}
