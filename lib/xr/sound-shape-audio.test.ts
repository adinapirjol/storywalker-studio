import { describe, expect, it, vi } from 'vitest';
import { SoundShapeAudio } from './sound-shape-audio';
import { INITIAL_SHAPE } from './sound-shape';

function contextFixture() {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn().mockReturnThis() });
  const source = { ...node(), buffer: null, loop: false, playbackRate: parameter(), start: vi.fn(), stop: vi.fn() };
  const filter = { ...node(), type: '', Q: parameter(), frequency: parameter() };
  const gains: ReturnType<typeof parameter>[] = [];
  const context = {
    state: 'running', sampleRate: 44100, currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(async () => { context.state = 'closed'; }),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 25.9459, numberOfChannels: 1 }),
    createBufferSource: () => source, createBiquadFilter: () => filter,
    createGain: () => { const gain = parameter(); gains.push(gain); return { ...node(), gain }; },
    createDelay: () => ({ ...node(), delayTime: parameter() }),
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), knee: parameter(), ratio: parameter() }),
    destination: {},
  };
  return { context, source, filter, gains };
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
});
