import type { XRScene, Decision } from './xr-scene';
import { moveJourneyEpisode } from './journey-grounding';

export type Regime = 'WORLD' | 'TIME' | 'MEMORY';
export type Point = { x: number; z: number };
export type EpisodeSpace = {
  id: string; members: number[]; label: string; start: string; end: string;
  world: Point; memory: Point; time: Point; count: number; durationHours: number;
  selections: { cueId: string; count: number }[]; author: boolean; transit: boolean;
};
/** Presentation containers only. No source episode, timestamp or profile is rewritten.
 * Consecutive Timeline records: <=25 km from FIRST stop, gap <=36 h.
 * Author episodes always retain their own container. No semantic clustering.
 */
export function episodeSpaces(scene: XRScene): EpisodeSpace[] {
  const episodes = scene.journeyEpisodes ?? [], groups: number[][] = [];
  const scale = scene.journeyLayout?.projection.metresPerUnit ?? 1;
  episodes.forEach((episode, i) => {
    const group = groups.at(-1), first = group && episodes[group[0]], last = group && episodes[group.at(-1)!];
    const timeline = episode.provenance.nodes.some(n => n.type === 'timeline');
    const w = episode.worldPosition?.position, f = first?.worldPosition?.position;
    if (group && first && last && w && f && timeline && first.provenance.nodes.some(n => n.type === 'timeline') &&
      Math.hypot(w.x - f.x, w.z - f.z) * scale <= 25000 && Date.parse(episode.start) - Date.parse(last.end) <= 36 * 3600000) group.push(i);
    else groups.push([i]);
  });
  return groups.map((members, i) => {
    const first = episodes[members[0]], all = members.map(n => episodes[n]);
    const average = (memory: boolean): Point => ({
      x: all.reduce((sum, e) => sum + (memory ? e.memoryPosition!.x : e.worldPosition!.position.x), 0) / all.length,
      z: all.reduce((sum, e) => sum + (memory ? e.memoryPosition!.z : e.worldPosition!.position.z), 0) / all.length,
    });
    // Union of recorded intervals; gaps do not become duration.
    const windows = all.map(e => [Date.parse(e.start), Date.parse(e.end)]).sort((a,b) => a[0]-b[0]);
    let duration = 0, start = windows[0][0], end = windows[0][1];
    for (const w of windows.slice(1)) { if (w[0] <= end) end = Math.max(end,w[1]); else { duration += end-start; [start,end] = w; } }
    duration += end-start;
    const counts = new Map<string, number>();
    all.forEach(e => e.listening?.selectedCues.forEach(c => counts.set(c.cueId,(counts.get(c.cueId) ?? 0)+c.count)));
    // Chronological sequence winds through a gallery. Spacing is ordinal, never geography or elapsed duration.
    const angle = i * .88 - Math.PI / 2, radius = 6 + 10 * i / Math.max(1,groups.length-1);
    const named = all.find(e => !/unlabelled/i.test(e.label));
    return { id: first.id, members, label: named?.label ?? `Episode ${String(i+1).padStart(2,'0')}`,
      start: first.start, end: new Date(Math.max(...windows.map(w=>w[1]))).toISOString(),
      world: average(false), memory: average(true), time: { x: Math.cos(angle)*radius, z: Math.sin(angle)*radius },
      count: all.reduce((sum,e)=>sum+(e.listening?.count??0),0), durationHours: duration/3600000,
      selections: [...counts].map(([cueId,count])=>({cueId,count})), author: !first.provenance.nodes.some(n=>n.type==='timeline'), transit: first.episodeKind==='transit' };
  });
}
export function spacePosition(space: EpisodeSpace, regime: Regime, memoryBase: 'WORLD' | 'TIME'): Point {
  if (regime === 'WORLD') return space.world;
  if (regime === 'TIME') return space.time;
  return memoryBase === 'WORLD' ? space.memory : { x: space.time.x + (space.memory.x-space.world.x), z: space.time.z+(space.memory.z-space.world.z) };
}
export function acceptedDensity(space: EpisodeSpace, decisions: Record<string,Decision>) {
  return space.selections.filter(s=>decisions[s.cueId]==='accepted').reduce((sum,s)=>sum+s.count,0);
}
/** Uniform displacement, clamped for the whole container rather than distorting members. */
export function moveEpisodeSpace(scene: XRScene, space: EpisodeSpace, dx: number, dz: number, base: 'WORLD'|'TIME', at = new Date().toISOString()) {
  const members = space.members.map(i=>scene.journeyEpisodes![i]);
  dx = Math.max(...members.map(e=>-20-e.memoryPosition!.x), Math.min(dx,...members.map(e=>20-e.memoryPosition!.x)));
  dz = Math.max(...members.map(e=>-20-e.memoryPosition!.z), Math.min(dz,...members.map(e=>20-e.memoryPosition!.z)));
  if (!Number.isFinite(dx+dz)) throw new Error('Invalid displacement');
  let result: XRScene = {...scene,journeyLayout:{...scene.journeyLayout!,mode:'MEMORY'}};
  for (const e of members) result = moveJourneyEpisode(result,e.id,e.memoryPosition!.x+dx,e.memoryPosition!.z+dz,at);
  result = {...result,journeyEpisodes:result.journeyEpisodes!.map(e=>members.some(m=>m.id===e.id) && e.memoryDecisions.at(-1)?.at===at ? {...e,memoryDecisions:e.memoryDecisions.map((d,i)=>i===e.memoryDecisions.length-1?{...d,representationBase:base,spaceId:space.id}:d)}:e)};
  return result;
}
