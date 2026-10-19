import { ambientLevel } from './sound-shape';

/** Microphone samples are reduced to one level; no input is audible or retained. */
export class SoundShapeMicrophone {
  private generation = 0;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples = new Float32Array(512);

  constructor(
    private getMedia = (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints),
    private createContext = () => new AudioContext(),
  ) {}

  async start(onEnded: () => void): Promise<boolean> {
    this.stop();
    const ticket = this.generation;
    const context = this.createContext();
    this.context = context;
    try {
      const analyser = context.createAnalyser(), mute = context.createGain();
      analyser.fftSize = 512;
      mute.gain.value = 0;
      analyser.connect(mute).connect(context.destination);
      // Request permission during the click; do not wait for an empty audio graph
      // to resume before showing the browser's microphone prompt.
      const resumed = context.resume().then(() => true, () => false);
      const stream = await this.getMedia({ video: false, audio: { echoCancellation: true } });
      if (ticket !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      this.stream = stream;
      stream.getTracks().forEach(track => track.addEventListener('ended', () => {
        if (ticket === this.generation) { this.stop(); onEnded(); }
      }, { once: true }));
      context.createMediaStreamSource(stream).connect(analyser);
      const running = await resumed;
      if (ticket !== this.generation) return false;
      if (!running) throw new Error('Microphone analysis unavailable');
      this.analyser = analyser;
      return true;
    } catch (error) {
      if (ticket !== this.generation) return false;
      this.stop();
      throw error;
    }
  }

  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return ambientLevel(this.samples);
  }

  stop() {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    const context = this.context;
    this.context = null;
    this.analyser = null;
    this.samples.fill(0);
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
