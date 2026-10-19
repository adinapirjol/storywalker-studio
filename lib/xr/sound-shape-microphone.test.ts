import { describe, expect, it, vi } from 'vitest';
import { SoundShapeMicrophone } from './sound-shape-microphone';

function fixture() {
  const node = { connect: vi.fn().mockReturnThis() };
  const mute = { ...node, gain: { value: 1 } };
  const analyser = { ...node, fftSize: 0, getFloatTimeDomainData: vi.fn((samples: Float32Array) => samples.fill(0.1)) };
  const context = {
    state: 'running', resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
    createGain: () => mute, createAnalyser: () => analyser,
    createMediaStreamSource: vi.fn(() => node), destination: {},
  };
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { context, track, stream, mute, analyser };
}

describe('optional ambient microphone lifecycle', () => {
  it('does not ask for access until enabled; input is muted and stop releases the device', async () => {
    const f = fixture(), getMedia = vi.fn().mockResolvedValue(f.stream);
    const mic = new SoundShapeMicrophone(getMedia, () => f.context as unknown as AudioContext);
    expect(getMedia).not.toHaveBeenCalled(); expect(mic.level()).toBe(0);
    expect(await mic.start(vi.fn())).toBe(true);
    expect(getMedia).toHaveBeenCalledWith({ video: false, audio: { echoCancellation: true } });
    expect(f.mute.gain.value).toBe(0); expect(mic.level()).toBeGreaterThan(0);
    mic.stop();
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.context.close).toHaveBeenCalledOnce();
    expect(mic.level()).toBe(0);
  });
  it('immediately stops a stream that arrives after the user switched the toggle off', async () => {
    const f = fixture();
    let resolve!: (stream: MediaStream) => void;
    const getMedia = vi.fn(() => new Promise<MediaStream>(done => { resolve = done; }));
    const mic = new SoundShapeMicrophone(getMedia, () => f.context as unknown as AudioContext);
    const pending = mic.start(vi.fn());
    await vi.waitFor(() => expect(getMedia).toHaveBeenCalledOnce());
    mic.stop(); resolve(f.stream);
    expect(await pending).toBe(false);
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(mic.level()).toBe(0);
    expect(f.context.createMediaStreamSource).not.toHaveBeenCalled();
  });
  it('fails closed when permission is declined without retrying', async () => {
    const f = fixture(), getMedia = vi.fn().mockRejectedValue(new Error('denied'));
    const mic = new SoundShapeMicrophone(getMedia, () => f.context as unknown as AudioContext);
    await expect(mic.start(vi.fn())).rejects.toThrow('denied');
    expect(getMedia).toHaveBeenCalledOnce(); expect(f.context.close).toHaveBeenCalledOnce();
    expect(mic.level()).toBe(0);
  });
  it('requests permission even while audio resume is pending, then honours cancellation', async () => {
    const f = fixture();
    let resume!: () => void;
    f.context.resume.mockImplementation(() => new Promise<void>(done => { resume = done; }));
    const getMedia = vi.fn().mockResolvedValue(f.stream);
    const mic = new SoundShapeMicrophone(getMedia, () => f.context as unknown as AudioContext);
    const pending = mic.start(vi.fn());
    expect(getMedia).toHaveBeenCalledOnce();
    mic.stop(); resume();
    expect(await pending).toBe(false); expect(f.track.stop).toHaveBeenCalledOnce();
    expect(mic.level()).toBe(0);
  });
  it('stops sampling and notifies the UI when the microphone disconnects', async () => {
    const f = fixture(), ended = vi.fn();
    const mic = new SoundShapeMicrophone(async () => f.stream, () => f.context as unknown as AudioContext);
    await mic.start(ended);
    const callback = f.track.addEventListener.mock.calls[0][1] as () => void;
    callback();
    expect(ended).toHaveBeenCalledOnce(); expect(f.track.stop).toHaveBeenCalledOnce();
    expect(mic.level()).toBe(0);
  });
});
