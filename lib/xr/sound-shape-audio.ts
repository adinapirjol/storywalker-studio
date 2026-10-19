import { soundParameters, unit, type SoundShape } from './sound-shape';

const MAX_FILE_BYTES = 16 * 1024 * 1024;
type Voice = {
  context: AudioContext;
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  wet: GainNode;
  master: GainNode;
};

/** Owns one selected in-memory loop. Never fetches, uploads or persists audio. */
export class SoundShapeAudio {
  private buffer: AudioBuffer | null = null;
  private voice: Voice | null = null;
  private decoding: AudioContext | null = null;
  private generation = 0;
  private selection = 0;

  constructor(private createContext = () => new AudioContext()) {}

  async load(file: File): Promise<number | null> {
    this.stop();
    const ticket = ++this.selection;
    const previous = this.decoding;
    this.decoding = null;
    if (previous) void previous.close().catch(() => {});
    this.buffer = null;
    if (file.size < 44 || file.size > MAX_FILE_BYTES) throw new Error('Choose a WAV smaller than 16 MB.');
    const context = this.createContext();
    this.decoding = context;
    try {
      const bytes = await file.arrayBuffer();
      if (ticket !== this.selection) return null;
      const header = new DataView(bytes);
      if (header.getUint32(0) !== 0x52494646 || header.getUint32(8) !== 0x57415645) {
        throw new Error('Choose the short WAV sketch.');
      }
      const buffer = await context.decodeAudioData(bytes);
      if (ticket !== this.selection) return null;
      if (buffer.duration < 1 || buffer.duration > 60 || buffer.numberOfChannels > 2) {
        throw new Error('Use a mono or stereo sketch between 1 and 60 seconds.');
      }
      this.buffer = buffer;
      return buffer.duration;
    } finally {
      if (this.decoding === context) this.decoding = null;
      if (context.state !== 'closed') void context.close().catch(() => {});
    }
  }

  async play(shape: SoundShape, volume: number): Promise<boolean> {
    this.stop();
    if (!this.buffer) return false;
    const ticket = this.generation;
    const context = this.createContext();
    try {
      const source = context.createBufferSource(), filter = context.createBiquadFilter();
      const wet = context.createGain(), master = context.createGain();
      const delay = context.createDelay(1), feedback = context.createGain();
      const limiter = context.createDynamicsCompressor();
      source.buffer = this.buffer;
      source.loop = true;
      source.playbackRate.value = 1;
      filter.type = 'lowpass'; filter.Q.value = 0.7;
      delay.delayTime.value = soundParameters(shape).delay;
      feedback.gain.value = 0.22;
      limiter.threshold.value = -8; limiter.knee.value = 4; limiter.ratio.value = 12;
      master.gain.value = 0;
      source.connect(filter);
      filter.connect(master);
      filter.connect(delay); delay.connect(wet).connect(master);
      delay.connect(feedback).connect(delay);
      master.connect(limiter).connect(context.destination);
      this.voice = { context, source, filter, wet, master };
      await context.resume();
      if (ticket !== this.generation) return false;
      this.update(shape, volume);
      source.start();
      return true;
    } catch (error) {
      if (ticket === this.generation) this.stop();
      if (context.state !== 'closed') void context.close().catch(() => {});
      throw error;
    }
  }

  update(shape: SoundShape, volume: number) {
    const voice = this.voice;
    if (!voice) return;
    const params = soundParameters(shape), now = voice.context.currentTime;
    voice.filter.frequency.setTargetAtTime(Math.min(params.cutoff, voice.context.sampleRate * 0.45), now, 0.08);
    voice.wet.gain.setTargetAtTime(params.echo, now, 0.08);
    voice.master.gain.setTargetAtTime(unit(volume) * 0.5, now, 0.05);
  }

  stop() {
    this.generation++;
    const voice = this.voice;
    this.voice = null;
    if (!voice) return;
    try { voice.source.stop(); } catch { /* A source awaiting resume has not started. */ }
    if (voice.context.state !== 'closed') void voice.context.close().catch(() => {});
  }

  dispose() {
    this.stop();
    this.selection++;
    this.buffer = null;
    const context = this.decoding;
    this.decoding = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
