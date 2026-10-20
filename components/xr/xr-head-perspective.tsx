'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { NEUTRAL_HEAD, relativeHead, type HeadPosition } from '@/lib/xr/head-perspective';
import { AirSwipe, type SwipeDirection, type SwipeFeedback } from '@/lib/xr/air-swipe';
import { indexPointer, drawHandOverlay, type HandPoint } from '@/lib/xr/finger-tracking';
import { PalmZoom } from '@/lib/xr/palm-open';
import css from './xr-head-perspective.module.css';

/** Mounted only in the fictional TIME view. Camera ownership ends on freeze/unmount/blur. */
export function XRHeadPerspective({ position, onBrowse, onDrag, onOpen, onClose, isOpen, onZoom }: { position: MutableRefObject<HeadPosition>; onBrowse: (direction: SwipeDirection) => void; onOpen: () => void; onClose: () => void; isOpen: boolean; onZoom: (amount:number) => void; onDrag: (progress: number, commit?: SwipeDirection) => void }) {
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback>({ phase: 'missing', progress: 0, direction: null });
  const [zoomAmount,setZoomAmount] = useState<number|null>(null);
  const drag = useRef(onDrag);
  const zoom = useRef({ isOpen, onZoom });
  useEffect(() => { zoom.current = { isOpen, onZoom }; }, [isOpen, onZoom]);
  useEffect(() => { drag.current = onDrag; }, [onDrag]);
  const [status, setStatus] = useState('Off · no camera access');
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState(0);
  const dispose = useRef<() => void>(() => {});
  const generation = useRef(0);
  const cameraPreview = useRef<HTMLCanvasElement>(null);
  const origin = useRef<HeadPosition | null>(null);
  function stop(message = 'Frozen · camera off') {
    generation.current++;
    drag.current(0);
    dispose.current();
    dispose.current = () => {};
    setActive(false); setStatus(message);
  }
  useEffect(() => {
    const freeze = () => { drag.current(0); generation.current++; dispose.current(); setActive(false); setStatus('Paused · camera off. Enable to resume.'); };
    const hidden = () => { if (document.hidden) freeze(); };
    window.addEventListener('blur', freeze); document.addEventListener('visibilitychange', hidden);
    return () => { drag.current(0); generation.current++; dispose.current(); position.current = NEUTRAL_HEAD;
      window.removeEventListener('blur', freeze); document.removeEventListener('visibilitychange', hidden); };
  }, [position]);
  async function start() {
    stop(); const id = generation.current; origin.current = null; position.current = NEUTRAL_HEAD;
    setPreview(0); setSwipeFeedback({ phase: 'missing', progress: 0, direction: null }); setActive(true); setStatus('Starting local tracking…');
    let stream: MediaStream | undefined, worker: Worker | undefined, timer: ReturnType<typeof setTimeout> | undefined, watchdog: ReturnType<typeof setTimeout> | undefined;
    const video = document.createElement('video'); video.muted = true; video.playsInline = true;
    const stale = () => generation.current !== id;
    dispose.current = () => { if (timer) clearTimeout(timer); if (watchdog) clearTimeout(watchdog); worker?.terminate(); stream?.getTracks().forEach(track => track.stop()); video.pause(); video.srcObject = null; };
    const fail = () => { if (!stale()) stop('Tracking unavailable · use the preview or normal navigation'); };
    const swipe = new AirSwipe(.08, Infinity);
    const expand = new PalmZoom();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) { fail(); return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } });
      if (stale()) { stream.getTracks().forEach(track => track.stop()); return; }
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', fail, { once: true }));
      video.srcObject = stream; await video.play(); if (stale()) return;
      worker = new Worker('/head-tracking-worker.js'); worker.onerror = fail;
      // Each response schedules the next frame: at most one frame is in flight.
      const frame = async () => {
        if (stale()) return;
        try { const bitmap = await createImageBitmap(video, { resizeWidth: 320, resizeHeight: Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth)) });
          if (stale()) { bitmap.close(); return; }
          const output = cameraPreview.current;
          if (output) {
            output.width = bitmap.width; output.height = bitmap.height;
            const ctx = output.getContext('2d');
            if (ctx) { ctx.translate(output.width, 0); ctx.scale(-1, 1); ctx.drawImage(bitmap, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
          }
          worker!.postMessage({ type: 'frame', bitmap, time: performance.now() }, [bitmap]);
        } catch { fail(); }
      };
      worker.onmessage = ({ data }) => {
        if (stale()) return;
        if (watchdog) clearTimeout(watchdog);
        watchdog = setTimeout(fail, 10000);
        if (data.type === 'error') { fail(); return; }
        if (data.type === 'position') {
          if(data.face && Number.isFinite(data.face.x) && Number.isFinite(data.face.y)){
            origin.current ??= data.face;
            const next=relativeHead(data.face,origin.current!);
            position.current={x:position.current.x*.5+next.x*.5,y:position.current.y*.5+next.y*.5};
          }
          const hands: HandPoint[][] = data.landmarks ?? [];
          const amount = expand.sample(hands,zoom.current.isOpen,performance.now());
          const pointer = amount !== null ? null : indexPointer(hands);
          if (cameraPreview.current) drawHandOverlay(cameraPreview.current, hands);
          setZoomAmount(amount);
          if(amount !== null){
            swipe.reset();drag.current(0);zoom.current.onZoom(amount);
            setSwipeFeedback({phase:'missing',progress:0,direction:null});
            setStatus('Zoom follows finger spread · gather to zoom out · lower your hand to release');
            timer=setTimeout(()=>void frame(),100);return;
          }
          const direction = swipe.sample(pointer, performance.now());
          const feedback = swipe.feedback;
          setSwipeFeedback({ ...feedback });
          if (direction) drag.current(feedback.progress, direction);
          else if (feedback.phase !== 'cooldown') drag.current(feedback.phase === 'ready' ? feedback.progress : 0);
          setStatus(feedback.phase === 'cooldown' ? (feedback.direction === 1 ? 'Next window · release and hold again' : 'Previous window · release and hold again')
            : feedback.phase === 'ready' ? 'Ready — move your index finger sideways toward either end'
            : feedback.phase === 'holding' ? 'Index finger found — hold briefly until Ready'
            : hands.length > 1 ? 'Two hands detected — keep only one in view' : hands.length ? 'Hand found — straighten your index finger' : 'No hand detected — bring your hand into the preview');
        }
        timer = setTimeout(() => void frame(), 100);
      };
      watchdog = setTimeout(fail, 30000);
      worker.postMessage({ type: 'init' });
    } catch { fail(); }
  }
  return <details className={css.panel}>
    <summary>Air gestures <span>{active ? 'on' : 'off'}</span></summary>
    <p>Camera and tracking stay in this browser. Nothing is recorded or saved.</p>
    <p>Lean to look around. Point and swipe to browse. Hold gathered fingertips to engage zoom, then spread or close them gradually. Lower your hand to release zoom. From an open window, start with an open palm.</p>
    <div className={css.actions}>
      <button onClick={() => active ? stop() : void start()}>{active ? 'Freeze · stop camera' : 'Enable air gestures'}</button>
      <button onClick={() => { origin.current = null; position.current = NEUTRAL_HEAD; setPreview(0); }}>Recenter lean</button>
      <button onClick={() => { stop('Off · no camera access'); position.current = NEUTRAL_HEAD; setPreview(0); }}>Reset view</button>
    </div>
    <div className={css.actions}><button onClick={isOpen ? onClose : onOpen}>{isOpen ? 'Return to browsing' : 'Open selected window'}</button><button onClick={() => onBrowse(-1)}>← Previous window</button><button onClick={() => onBrowse(1)}>Next window →</button></div>
    <label>Camera-free lean preview <input type="range" min="-1" max="1" step="0.05" value={preview} disabled={active}
      onChange={e => { const x = Number(e.target.value); setPreview(x); position.current = { x, y: 0 }; }} /></label>
    {active && <div className={css.swipeGuide}>
      <canvas ref={cameraPreview} className={css.cameraPreview} width={320} height={240} aria-label="Mirrored local camera preview with detected hand skeleton and highlighted index fingertip" />
      <p className={css.previewCaption}>Mirror view · yellow dot = index fingertip · local only</p>
      {zoomAmount!==null&&<label>Zoom {Math.round(zoomAmount*100)}%<meter min={0} max={1} value={zoomAmount} /></label>}
      <div className={css.swipeLabels}><span>← Next</span><strong>{swipeFeedback.phase === 'ready' ? 'Ready' : swipeFeedback.phase === 'cooldown' ? 'Done' : 'Hold finger'}</strong><span>Previous →</span></div>
      <div className={css.swipeTrack} aria-hidden="true"><span style={{ left: `${50 + swipeFeedback.progress * 45}%` }} /></div>
    </div>}
    <p role="status">{status}</p>
  </details>;
}
