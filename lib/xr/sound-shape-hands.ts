import { drawHandOverlay, type HandPoint } from './finger-tracking';

type HandCapture = {
  preview: HTMLCanvasElement;
  onHands: (hands: HandPoint[][]) => void;
  onError: () => void;
};

/** Reuses the local XR detector. One frame in flight; cancellation also covers permission prompts. */
export function startShapeHands({ preview, onHands, onError }: HandCapture): () => void {
  let disposed = false;
  let stream: MediaStream | undefined, worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;

  const stop = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer); clearTimeout(watchdog);
    worker?.terminate();
    stream?.getTracks().forEach(track => track.stop());
    video.pause(); video.srcObject = null;
    preview.getContext('2d')?.clearRect(0, 0, preview.width, preview.height);
  };
  const fail = () => { if (!disposed) { stop(); onError(); } };
  const armWatchdog = (ms: number) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(fail, ms);
  };
  async function frame() {
    if (disposed) return;
    try {
      const bitmap = await createImageBitmap(video, { resizeWidth: 320, resizeHeight: 240 });
      if (disposed) { bitmap.close(); return; }
      const context = preview.getContext('2d');
      if (context) {
        context.save(); context.translate(preview.width, 0); context.scale(-1, 1);
        context.drawImage(bitmap, 0, 0, preview.width, preview.height); context.restore();
      }
      try { worker!.postMessage({ type: 'frame', bitmap, time: performance.now() }, [bitmap]); }
      catch { bitmap.close(); throw new Error('Hand frame unavailable'); }
    } catch { fail(); }
  }
  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) {
        fail(); return;
      }
      armWatchdog(30000);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
      stream.getTracks().forEach(track => track.addEventListener('ended', fail, { once: true }));
      video.srcObject = stream;
      await video.play();
      if (disposed) return;
      worker = new Worker('/head-tracking-worker.js');
      worker.onerror = fail;
      worker.onmessage = ({ data }) => {
        if (disposed) return;
        armWatchdog(10000);
        if (data.type === 'error') { fail(); return; }
        if (data.type === 'ready') { void frame(); return; }
        if (data.type !== 'position') return;
        const hands: HandPoint[][] = data.landmarks ?? [];
        drawHandOverlay(preview, hands);
        onHands(hands);
        timer = setTimeout(() => void frame(), 80);
      };
      worker.postMessage({ type: 'init' });
    } catch { fail(); }
  }
  void start();
  return stop;
}
