import { afterEach, describe, expect, it, vi } from 'vitest';
import { startShapeHands } from './sound-shape-hands';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function captureFixture(getMedia: () => Promise<MediaStream>) {
  vi.useFakeTimers();
  const video = { muted: false, playsInline: false, srcObject: null, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() };
  const context = { save: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), restore: vi.fn(), clearRect: vi.fn() };
  const preview = { width: 320, height: 240, getContext: () => context } as unknown as HTMLCanvasElement;
  const worker = { onmessage: undefined as undefined | ((event: { data: object }) => void), onerror: undefined as undefined | (() => void), postMessage: vi.fn(), terminate: vi.fn() };
  const bitmap = { close: vi.fn() };
  const createBitmap = vi.fn().mockResolvedValue(bitmap);
  const WorkerMock = vi.fn(function () { return worker; });
  vi.stubGlobal('document', { createElement: () => video });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(getMedia) } });
  vi.stubGlobal('window', { Worker: WorkerMock, createImageBitmap: createBitmap });
  vi.stubGlobal('Worker', WorkerMock); vi.stubGlobal('createImageBitmap', createBitmap);
  return { video, preview, context, worker, bitmap, createBitmap };
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
function media() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

describe('local hand capture ownership', () => {
  it('releases a camera arriving after cancellation and never starts inference', async () => {
    const m = media(); let resolve!: (stream: MediaStream) => void;
    const f = captureFixture(() => new Promise<MediaStream>(done => { resolve = done; }));
    const onError = vi.fn();
    const stop = startShapeHands({ preview: f.preview, onHands: vi.fn(), onError });
    stop(); resolve(m.stream); await flush();
    expect(m.track.stop).toHaveBeenCalledOnce(); expect(f.worker.postMessage).not.toHaveBeenCalled();
    expect(f.createBitmap).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps only one image in flight and stops camera, worker and queued frames together', async () => {
    const m = media(), f = captureFixture(async () => m.stream), onHands = vi.fn();
    const stop = startShapeHands({ preview: f.preview, onHands, onError: vi.fn() });
    await flush();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: 'init' });
    f.worker.onmessage!({ data: { type: 'ready' } }); await flush();
    expect(f.createBitmap).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    expect(f.createBitmap).toHaveBeenCalledOnce();
    f.worker.onmessage!({ data: { type: 'position', landmarks: [] } });
    expect(onHands).toHaveBeenCalledWith([]);
    stop(); await vi.advanceTimersByTimeAsync(1000);
    expect(f.createBitmap).toHaveBeenCalledOnce(); expect(m.track.stop).toHaveBeenCalledOnce();
    expect(f.worker.terminate).toHaveBeenCalledOnce(); expect(f.video.srcObject).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('releases permission-pending capture after the startup deadline', async () => {
    const m = media(); let resolve!: (stream: MediaStream) => void;
    const f = captureFixture(() => new Promise<MediaStream>(done => { resolve = done; })), onError = vi.fn();
    startShapeHands({ preview: f.preview, onHands: vi.fn(), onError });
    await vi.advanceTimersByTimeAsync(30000);
    expect(onError).toHaveBeenCalledOnce();
    resolve(m.stream); await flush();
    expect(m.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
