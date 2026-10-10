import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SOUND_CATALOG,rankSounds} from './xr-sound-catalog';
import {composeEpisodeSound,soundForEpisode} from './xr-sound';
import {DEMO_XR_SCENE,xrSceneSchema,reviewExport,parseSceneFile} from './xr-scene';
import {groundJourney} from './journey-grounding';
import {validateDraftReview} from './xr-draft';
function fixture(){return groundJourney(DEMO_XR_SCENE,{schemaVersion:1,source:'google-timeline',importedAt:'2026-05-28T00:00:00Z',schemaEncountered:'fixture',records:[{kind:'visit',startAt:'2026-05-16T00:00:00Z',endAt:'2026-05-17T00:00:00Z',latitude:40,longitude:10,certainty:'reported',authorCorrected:false}]},{schemaVersion:1,source:'lastfm-scrobbles',importedAt:'2026-05-28T00:00:00Z',records:[]},{from:'2026-05-15T00:00:00Z',toExclusive:'2026-05-28T00:00:00Z',timelineToExclusive:'2026-05-27T00:00:00Z',timeZone:'UTC',sources:[{type:'timeline',id:'t',fingerprint:'t',capturedAt:'2026-05-28T00:00:00Z'},{type:'lastfm',id:'l',fingerprint:'l',capturedAt:'2026-05-28T00:00:00Z'}]});}
it('ranks only exact Author-selected texture tags with deterministic ties',()=>{
 const candidates=rankSounds(['metal','percussive']);expect(candidates[0].matched).toEqual(['metal','percussive']);expect(candidates[0].sound.id).toContain('impactmetal');
 expect(rankSounds(['nostalgia']).every(s=>s.matched.length===0)).toBe(true);
 expect(rankSounds([]).map(s=>s.sound.id)).toEqual(SOUND_CATALOG.map(s=>s.id).sort());
});
it('records a reversible composition with source provenance, preserving geographic and listening evidence',()=>{
 const scene=fixture(),before=JSON.stringify(scene),episode=scene.journeyEpisodes![0].id,sound=SOUND_CATALOG[0];
 const attached=composeEpisodeSound(scene,episode,sound.id,['low'],'Author texture note','2026-09-29T00:00:00Z');
 expect(xrSceneSchema.safeParse(attached).success).toBe(true);expect(JSON.stringify(scene)).toBe(before);expect(attached.journeyEpisodes).toEqual(scene.journeyEpisodes);expect(attached.cues).toEqual(scene.cues);
 expect(validateDraftReview(scene,{scene:attached,decisions:{}}).scene).toEqual(attached);
 expect(parseSceneFile(reviewExport(attached,{})).scene).toEqual(attached);
 const removed=composeEpisodeSound(attached,episode,null,[],'','2026-09-29T01:00:00Z');expect(soundForEpisode(removed,episode)).toBeUndefined();expect(removed.experience!.soundDecisions).toHaveLength(2);
 expect(()=>validateDraftReview(attached,{scene,decisions:{}})).toThrow('sound decisions');
 const forged=structuredClone(attached);forged.experience!.soundDecisions![0].source!.creator='Someone else';expect(xrSceneSchema.safeParse(forged).success).toBe(false);
 expect(()=>composeEpisodeSound(scene,episode,'unknown',[],'' )).toThrow();
});
it('ships playable local WAVs matching their provenance fingerprints',()=>{
 for(const sound of SOUND_CATALOG){const bytes=readFileSync(`public${sound.url}`);expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.toString('ascii',8,12)).toBe('WAVE');expect(createHash('sha256').update(bytes).digest('hex')).toBe(sound.source.sha256);expect(sound.source.license).toBe('CC0-1.0');}
});
