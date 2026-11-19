import { describe, expect, it, vi } from 'vitest';
import { SoundShapeAudio } from './sound-shape-audio';
import { INITIAL_SHAPE } from './sound-shape';

function contextFixture() {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn().mockReturnThis() });
  const source = { ...node(), buffer: null, loop: false, playbackRate: parameter(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
  const filter = { ...node(), type: '', Q: parameter(), frequency: parameter() };
  const gains: ReturnType<typeof parameter>[] = [];
  const delay = { ...node(), delayTime: parameter() };
  const context = {
    state: 'running', sampleRate: 44100, currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(async () => { context.state = 'closed'; }),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 25.9459, numberOfChannels: 1 }),
    createBufferSource: () => source, createBiquadFilter: () => filter,
    createGain: () => { const gain = parameter(); gains.push(gain); return { ...node(), gain }; },
    createDelay: () => delay,
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), knee: parameter(), ratio: parameter() }),
    destination: {},
  };
  return { context, source, filter, gains, delay };
}
function wav() {
  const bytes = new Uint8Array(44), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x52494646); view.setUint32(8, 0x57415645);
  return new File([bytes], 'fictional-loop.wav', { type: 'audio/wav' });
}

describe('local 148 BPM sketch playback', () => {
  it('loads only after selection, loops at the source rate, and shapes tone and echoes', async () => {
    const contexts: ReturnType<typeof contextFixture>[] = [];
    const create = vi.fn(() => { const f = contextFixture(); contexts.push(f); return f.context as unknown as AudioContext; });
    const audio = new SoundShapeAudio(create);
    expect(create).not.toHaveBeenCalled();
    expect(await audio.load(wav())).toBeCloseTo(25.9459);
    expect(contexts[0].context.close).toHaveBeenCalledOnce();
    expect(await audio.play(INITIAL_SHAPE, 0.3)).toBe(true);
    const playing = contexts[1];
    expect(playing.source.loop).toBe(true); expect(playing.source.playbackRate.value).toBe(1);
    expect(playing.source.start).toHaveBeenCalledOnce();
    audio.update({ stretch: 1, fold: 1 }, 1);
    expect(playing.filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(14400, 0, 0.08);
    expect(playing.gains[0].setTargetAtTime).toHaveBeenLastCalledWith(0.32, 0, 0.08);
    expect(playing.gains[1].setTargetAtTime).toHaveBeenLastCalledWith(0.5, 0, 0.05);
    audio.stop();
    expect(playing.source.stop).toHaveBeenCalledOnce(); expect(playing.context.close).toHaveBeenCalledOnce();
  });
  it('does not begin playing after Stop while audio resume is still pending', async () => {
    const decode = contextFixture(), playing = contextFixture();
    let resolve!: () => void;
    playing.context.resume.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const create = vi.fn().mockReturnValueOnce(decode.context).mockReturnValueOnce(playing.context);
    const audio = new SoundShapeAudio(create);
    await audio.load(wav());
    const pending = audio.play(INITIAL_SHAPE, 0.3);
    audio.stop(); resolve();
    expect(await pending).toBe(false); expect(playing.source.start).not.toHaveBeenCalled();
    expect(playing.context.close).toHaveBeenCalledOnce();
  });
  it('discards an in-flight decode after leaving the instrument', async () => {
    const f = contextFixture();
    let resolve!: (value: { duration: number; numberOfChannels: number }) => void;
    f.context.decodeAudioData.mockImplementation(() => new Promise(done => { resolve = done; }));
    const audio = new SoundShapeAudio(() => f.context as unknown as AudioContext);
    const pending = audio.load(wav());
    await vi.waitFor(() => expect(f.context.decodeAudioData).toHaveBeenCalledOnce());
    audio.dispose(); resolve({ duration: 26, numberOfChannels: 1 });
    expect(await pending).toBeNull(); expect(await audio.play(INITIAL_SHAPE, 0.3)).toBe(false);
  });
  it('rejects wrong file content and oversized duration without leaving a context running', async () => {
    const f = contextFixture(), audio = new SoundShapeAudio(() => f.context as unknown as AudioContext);
    await expect(audio.load(new File([new Uint8Array(44)], 'not-really.wav'))).rejects.toThrow('WAV');
    expect(f.context.decodeAudioData).not.toHaveBeenCalled(); expect(f.context.close).toHaveBeenCalledOnce();
    const long = contextFixture(); long.context.decodeAudioData.mockResolvedValue({ duration: 600, numberOfChannels: 1 });
    const second = new SoundShapeAudio(() => long.context as unknown as AudioContext);
    await expect(second.load(wav())).rejects.toThrow('60 seconds');
    expect(long.context.close).toHaveBeenCalledOnce();
  });
  it('plays one phrase at its original speed, clocks from audio time, and finishes once', async () => {
    const decode = contextFixture(), playing = contextFixture(), ended = vi.fn();
    const create = vi.fn().mockReturnValueOnce(decode.context).mockReturnValueOnce(playing.context);
    const audio = new SoundShapeAudio(create);
    await audio.load(wav());
    expect(audio.selectedFingerprint()).toMatch(/^[a-f0-9]{64}$/);
    expect(await audio.play(INITIAL_SHAPE, 0.3, { bpm: 115, loop: false, preserveWords: true, onEnded: ended })).toBe(true);
    expect(playing.source.loop).toBe(false); expect(playing.source.playbackRate.value).toBe(1);
    expect(playing.delay.delayTime.value).toBeCloseTo(60 / 115 / 2);
    playing.context.currentTime = 7.25;
    expect(audio.position()).toBe(7.25); expect(audio.isPlaying()).toBe(true);
    audio.update({ stretch: 0, fold: 1 }, 0.3, { formation: 'orbit', openness: 1, echo: 1 });
    expect(playing.filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(14400, 7.25, 0.08);
    expect(playing.gains[0].setTargetAtTime.mock.lastCall![0]).toBeLessThanOrEqual(0.12);
    const gainWithReading = playing.gains[1].setTargetAtTime.mock.lastCall![0];
    // Refusing the reading means no frame; transport and source gain are untouched.
    audio.update({ stretch: 0, fold: 1 }, 0.3, null);
    expect(playing.filter.frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThanOrEqual(6000);
    expect(playing.gains[1].setTargetAtTime.mock.lastCall![0]).toBe(gainWithReading);
    expect(playing.source.stop).not.toHaveBeenCalled();
    playing.source.onended!(); playing.source.onended!();
    expect(ended).toHaveBeenCalledOnce(); expect(audio.isPlaying()).toBe(false);
    expect(playing.context.close).toHaveBeenCalledOnce();
  });
  it('ignores an ended event from a stopped voice and clears the fingerprint on disposal', async () => {
    const decode = contextFixture(), playing = contextFixture(), ended = vi.fn();
    const audio = new SoundShapeAudio(vi.fn().mockReturnValueOnce(decode.context).mockReturnValueOnce(playing.context));
    await audio.load(wav()); await audio.play(INITIAL_SHAPE, 0.3, { loop: false, onEnded: ended });
    audio.dispose(); playing.source.onended!();
    expect(ended).not.toHaveBeenCalled(); expect(audio.selectedFingerprint()).toBeNull();
    expect(audio.position()).toBe(0);
  });
  it('identifies the selected file before the decoder detaches its bytes', async () => {
    const f = contextFixture();
    const file = wav();
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const expected = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    f.context.decodeAudioData.mockImplementation(async (bytes: ArrayBuffer) => {
      structuredClone(bytes, { transfer: [bytes] });
      return { duration: 22, numberOfChannels: 2 };
    });
    const audio = new SoundShapeAudio(() => f.context as unknown as AudioContext);
    expect(await audio.load(file)).toBe(22);
    expect(audio.selectedFingerprint()).toBe(expected);
  });
});
