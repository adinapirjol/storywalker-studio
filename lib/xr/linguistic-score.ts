import { z } from 'zod';

const accentSchema = z.object({
  kind: z.enum(['word', 'beat', 'drop']),
  reaction: z.enum(['gather', 'ripple', 'compress', 'burst', 'release', 'halo']),
  durationSeconds: z.number().finite().min(0.25).max(1.5),
  strength: z.number().finite().min(0).max(1),
}).strict();

const cueSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,48}$/),
  title: z.string().min(1).max(120),
  excerpt: z.string().max(1200),
  reading: z.string().min(1).max(1200),
  startSeconds: z.number().finite().min(0).max(60),
  timing: z.enum(['proposed', 'author-adjusted']),
  decision: z.enum(['unresolved', 'accepted', 'revised', 'refused']),
  formation: z.enum(['gather', 'carry', 'open', 'orbit']),
  openness: z.number().finite().min(0).max(1),
  echo: z.number().finite().min(0).max(1),
  note: z.string().max(1200).optional(),
  accent: accentSchema.nullable().optional(),
}).strict();

const changeSchema = z.object({
  cueId: z.string().max(48),
  at: z.string().datetime(),
  before: cueSchema,
}).strict();

export const linguisticScoreSchema = z.object({
  version: z.literal(1),
  private: z.literal(true),
  canonical: z.literal(false),
  title: z.string().min(1).max(160),
  authorTranscript: z.string().min(1).max(12000),
  notes: z.string().max(2400),
  source: z.object({
    offsetSeconds: z.number().finite().min(0).max(86400),
    durationSeconds: z.number().finite().min(1).max(60),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  gridBpm: z.number().finite().min(60).max(200),
  cues: z.array(cueSchema).min(1).max(32),
  history: z.array(changeSchema).max(128),
}).strict().superRefine((score, ctx) => {
  const ids = new Set<string>();
  for (const [index, cue] of score.cues.entries()) {
    if (ids.has(cue.id) || cue.startSeconds >= score.source.durationSeconds ||
      (index === 0 && cue.startSeconds !== 0) ||
      (index > 0 && cue.startSeconds <= score.cues[index - 1].startSeconds)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cues', index], message: 'Cues need unique identities and increasing times within the clip, starting at zero.' });
    }
    ids.add(cue.id);
  }
  for (const change of score.history) {
    if (!ids.has(change.cueId) || change.before.id !== change.cueId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['history'], message: 'History must belong to a scene cue.' });
    }
  }
});

export type LinguisticScore = z.infer<typeof linguisticScoreSchema>;
export type LinguisticCue = LinguisticScore['cues'][number];
export type SoundAccent = z.infer<typeof accentSchema>;
export type SceneFrame = Pick<LinguisticCue, 'formation' | 'openness' | 'echo'>;
export const MAX_SCORE_BYTES = 128 * 1024;

export function parseLinguisticScore(text: string): LinguisticScore {
  if (new TextEncoder().encode(text).length > MAX_SCORE_BYTES) throw new Error('Score too large.');
  return linguisticScoreSchema.parse(JSON.parse(text));
}

export function matchesScoreAudio(score: LinguisticScore, duration: number | null, sha256: string | null): boolean {
  return duration !== null && Math.abs(duration - score.source.durationSeconds) < 0.1 && sha256 === score.source.sha256;
}

export function cueAt(score: LinguisticScore, seconds: number): number {
  const time = Number.isFinite(seconds) ? seconds : 0;
  let selected = 0;
  for (let index = 1; index < score.cues.length; index++) {
    if (time < score.cues[index].startSeconds) break;
    selected = index;
  }
  return selected;
}

/** A refusal removes the reading's effects; it never changes source audio or transport. */
export function sceneFrame(cue: LinguisticCue, previewUnresolved: boolean): SceneFrame | null {
  if (!readingEnabled(cue, previewUnresolved)) return null;
  return { formation: cue.formation, openness: cue.openness, echo: cue.echo };
}

export function readingEnabled(cue: LinguisticCue, previewUnresolved: boolean): boolean {
  return cue.decision !== 'refused' && (cue.decision !== 'unresolved' || previewUnresolved);
}

export function reviseCue(
  score: LinguisticScore, id: string, patch: Partial<Pick<LinguisticCue, 'reading' | 'decision' | 'startSeconds' | 'timing' | 'formation' | 'openness' | 'echo' | 'accent'>>,
  at = new Date().toISOString(),
): LinguisticScore {
  if (score.history.length >= 128) throw new Error('Keep this version locally before starting a new revision history.');
  const before = score.cues.find(cue => cue.id === id);
  if (!before) throw new Error('Unknown cue.');
  return parseLinguisticScore(JSON.stringify({
    ...score,
    cues: score.cues.map(cue => cue.id === id ? { ...cue, ...patch } : cue),
    history: [...score.history, { cueId: id, at, before }],
  }));
}
