export type GeneratedMusicSample = {
  id: string;
  title: string;
  bpm: number;
  length: string;
  description: string;
  source: string;
};

export const XR_GENERATED_MUSIC_SAMPLES: GeneratedMusicSample[] = [
  {
    id: 'noise-era-rhythm-132',
    title: 'Noise Era · rhythm sketch',
    bpm: 132,
    length: '16 bars',
    description: 'A source-free percussion mix generated in Python.',
    source: 'Python generator · synthesized drums only',
  },
  {
    id: 'acid-pressure-148',
    title: 'Acid Pressure · dry study',
    bpm: 148,
    length: '16 bars',
    description: 'The original punchy, close-miked machine sketch; kept dry for comparison.',
    source: 'Python generator · synthesized drums, bass and noise',
  },
  {
    id: 'acid-pressure-industrial-v4',
    title: 'Acid Pressure · saturated machine',
    bpm: 148,
    length: '16 bars + room tail',
    description: 'Near-single-note acid pressure, rougher saturation and subdued highs to lose the arcade-like melody.',
    source: 'Python generator · original synths with darker industrial treatment',
  },
  {
    id: 'acid-pressure-warehouse-v3',
    title: 'Acid Pressure · dense warehouse room',
    bpm: 148,
    length: '16 bars + room tail',
    description: 'A dark, dense stereo room with restrained reflections; kick and sub stay forward.',
    source: 'Python generator · original synth arrangement with a new feedback-delay room',
  },
  {
    id: 'acid-pressure-reverb-v2',
    title: 'Acid Pressure · warehouse reverb',
    bpm: 148,
    length: '16 bars + reverb tail',
    description: 'A wider, darker stereo room with a short pre-delay and a clear, mostly dry kick.',
    source: 'Python generator · same original synth arrangement, new algorithmic reverb',
  },
  {
    id: 'acid-pressure-concrete-room-v1',
    title: 'Acid Pressure · concrete room',
    bpm: 148,
    length: '16 bars + room tail',
    description: 'A stripped, low-register acid pulse with rough percussion, a heavy forward kick and a broad, diffuse concrete-room tail.',
    source: 'Python generator · original synthesized arrangement and diffuse room model',
  },
];
