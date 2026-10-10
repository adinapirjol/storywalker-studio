import type {ContextState, Observation} from './context-contract';

export type BodyWindow = {
 id: string; start: string; end: string; revision: number;
 readings: Observation[]; listening: Observation[]; locations: Observation[];
 relationship: string; support: string; stale: boolean;
};
/** Presentation only. This rehearsal cannot consume Vault/HealthKit or Spotify sources. */
export function bodyWindows(state: ContextState): BodyWindow[] {
 const allowed = state.observations.filter(o => o.source_type === 'fictional' && o.acquisition === 'simulated' && !state.deleted_sources.includes(o.source_id));
 return state.captures.slice(0, 3).map(c => {
  const selected = allowed.filter(o => c.context.observation_ids.includes(o.id));
  const proposalIds = new Set(state.proposals.filter(p => p.capture_id === c.id).map(p => p.id));
  const decision = state.decisions.filter(d => proposalIds.has(d.proposal_id)).at(-1);
  const memory = state.memories.filter(m => m.id.startsWith(c.id)).at(-1);
  return {id:c.id,start:c.context.start,end:c.context.end,revision:c.context.revision,
   readings:selected.filter(o => o.payload.kind === 'heart_rate').sort((a,b) => Date.parse(a.event_start)-Date.parse(b.event_start) || a.id.localeCompare(b.id)),
   listening:selected.filter(o => o.payload.kind === 'listening' && o.payload.policy === 'fictional'),
   locations:selected.filter(o => o.payload.kind === 'location'),
   relationship:decision?.status ?? 'awaiting Author',support:memory?.support ?? 'no canonical account',stale:c.context.stale_location};
 });
}
export function tempoAt(window: BodyWindow, reading: Observation | undefined) {
 if (!reading) return [];
 const at = Date.parse(reading.event_start);
 return window.listening.filter(o => Date.parse(o.event_start) <= at && at <= Date.parse(o.event_end));
}
export type BodyCluster = {label: string; windows: BodyWindow[]; coveredSeconds: number};
export type BodyPlaybackMode = 'preview' | 'measured';
/** Presentation clock only: observations are never interpolated or written back. */
export function bodyPlaybackDelay(readings: Observation[], index: number, speed: number, mode: BodyPlaybackMode = 'measured'): number | null {
 if (!Number.isFinite(speed) || speed <= 0 || index < 0 || index >= readings.length-1) return null;
 const gap = Date.parse(readings[index+1].event_start)-Date.parse(readings[index].event_start);
 return Number.isFinite(gap) && gap >= 0 ? mode === 'preview' ? 2000 : Math.max(16,gap/speed) : null;
}
/** A slow quarter-time visual envelope, not extracted bass or physiological entrainment. */
export function bodyFieldScale(seconds: number, bpm: number, depth: number, enabled: boolean, reducedMotion: boolean): number {
 if (!enabled || reducedMotion || ![seconds,bpm,depth].every(Number.isFinite)) return 1;
 const rate = Math.max(40,Math.min(160,bpm))/240;
 return 1 + Math.max(0,Math.min(.04,depth))*(1-Math.cos(seconds*rate*Math.PI*2))/2;
}
/** Consecutive windows only. Stale/ambiguous geography never bridges a cluster. */
export function groupBodyWindows(windows: BodyWindow[], level: 'city'|'country', maxGapSeconds = 300): BodyCluster[] {
 const clusters: BodyCluster[] = [];
 for (const window of [...windows].sort((a,b) => Date.parse(a.start)-Date.parse(b.start))) {
  const places = [...new Set(window.locations.flatMap(o => o.payload.kind === 'location' && o.payload[level] ? [level === 'city' ? `${o.payload.city}, ${o.payload.country ?? 'country unknown'}` : o.payload.country!] : []))];
  const known = !window.stale && places.length === 1;
  const label = known ? places[0] : 'Uncertain / missing place';
  const previous = clusters.at(-1), lastEnd = previous ? Math.max(...previous.windows.map(w => Date.parse(w.end))) : -Infinity;
  if (known && previous?.label === label && Date.parse(window.start)-lastEnd <= maxGapSeconds*1000) {
   previous.coveredSeconds += Math.max(0,Date.parse(window.end)-Math.max(Date.parse(window.start),lastEnd))/1000;
   previous.windows.push(window);
  } else clusters.push({label,windows:[window],coveredSeconds:Math.max(0,Date.parse(window.end)-Date.parse(window.start))/1000});
 }
 return clusters;
}
