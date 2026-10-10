import {z} from 'zod';
import {SOUND_CATALOG} from './xr-sound-catalog';
import type {XRScene} from './xr-scene';
export const soundDecisionSchema=z.object({
 episodeId:z.string(),soundId:z.string().nullable(),at:z.string().datetime(),author:z.literal('Author'),
 tags:z.array(z.string().max(40)).max(20),note:z.string().max(500),
 source:z.object({creator:z.string(),collection:z.string(),page:z.string().url(),license:z.literal('CC0-1.0'),licenseUrl:z.string().url(),originalFile:z.string(),sha256:z.string(),originalSha256:z.string(),processing:z.string()}).strict().nullable(),
 interpretation:z.literal('Authored sound composition; not evidence of past listening or emotion'),
}).strict();
export function soundForEpisode(scene:XRScene,episodeId:string){
 const choice=[...(scene.experience?.soundDecisions??[])].reverse().find(d=>d.episodeId===episodeId);
 return SOUND_CATALOG.find(s=>s.id===choice?.soundId);
}
export function composeEpisodeSound(scene:XRScene,episodeId:string,soundId:string|null,tags:string[],note:string,at=new Date().toISOString()):XRScene{
 const sound=SOUND_CATALOG.find(s=>s.id===soundId);
 if(soundId&&!sound)throw Error('Unknown catalogue sound');
 if(!scene.journeyEpisodes?.some(e=>e.id===episodeId))throw Error('Unknown episode');
 return {...scene,experience:{...(scene.experience??{regime:'MEMORY',memoryBase:'WORLD',fragmentDecisions:[]}),soundDecisions:[...(scene.experience?.soundDecisions??[]),{episodeId,soundId,at,author:'Author',tags,note,source:sound?{...sound.source,license:'CC0-1.0'}:null,interpretation:'Authored sound composition; not evidence of past listening or emotion'}]}};
}
