import { groundJourney } from './journey-grounding';
import { episodeSpaces, moveEpisodeSpace } from './journey-experience';
import { composeEpisodeSound } from './xr-sound';
import { SOUND_CATALOG } from './xr-sound-catalog';
import { xrSceneSchema, type XRScene, type Decision } from './xr-scene';

/** Entirely invented fixture. Public city reference coordinates are stage anchors,
 * not anyone's itinerary. No imports, Vault reads, random values or live services. */
export function auroraCoastXR(): {scene: XRScene; decisions: Record<string,Decision>} {
 const at='2027-07-30T12:00:00.000Z';
 const artists=['Mirror Static','Soft Relay','Luma North'];
 const cues:XRScene['cues']=artists.map((title,i)=>({id:`aurora-music-${i}`,title,source:'lastfm',provenance:'Fictional Aurora Coast listening fixture; never fetched from Last.fm.',note:`Candidate recurring artist: ${title}`,x:0,z:0,radius:5,frequency:180+i*60,minutes:5,treatment:'silent',evidence:{kind:'source-analysis',sourceId:'fictional:aurora:listening',facts:[`Grouping key: ${JSON.stringify([title])}`,'Invented listening observations for the public preview.'],authorLabels:[],interpretation:'No emotional meaning inferred.'}}));
 cues.push({id:'aurora-afterimage',title:'A film made of tides',source:'author',provenance:'Invented cultural fragment for Aurora Coast.',note:'An Author-selected fictional film fragment.',x:0,z:0,radius:5,frequency:220,minutes:5,treatment:'silent',evidence:{kind:'author-statement',sourceId:'fictional:aurora:fragment',facts:['Imaginary work: A film made of tides.','Chosen for the fictional composition; no viewing date asserted.'],authorLabels:['afterimage'],interpretation:'Composition only.'}});
 const stops=[['Ljubljana / departure',46.0569,14.5058],['Afterlight Fields / fictional festival',46.32,13.73],['Venice / tidal intervals',45.4408,12.3155],['Piran / listening room',45.5283,13.5684],['Vienna / intermission',48.2082,16.3738],['Berlin / open ending',52.52,13.405]] as const;
 const start=Date.parse('2027-07-18T08:00:00Z');
 const records=stops.flatMap(([locationLabel,latitude,longitude],i)=>[0,1,2].map(w=>({kind:'visit',startAt:new Date(start+i*36*3600000+w*7*3600000).toISOString(),endAt:new Date(start+i*36*3600000+(w*7+5)*3600000).toISOString(),locationLabel,latitude:latitude+w*.004,longitude,certainty:'reported',authorCorrected:false})));
 const plays=records.flatMap((r,i)=>i===8?[]:Array.from({length:12+i%5*6},(_,j)=>({playedAt:new Date(Date.parse(r.startAt)+(j+1)*240000).toISOString(),artistName:artists[(Math.floor(i/3)+(j%5===0?1:0))%3],trackName:['Temporary Cities','Fence Lights','Orange Wristband'][j%3],albumName:'Invented Coast',importerProvenance:'fictional-fixture'})));
 // One observation deliberately falls in a gap rather than borrowing a visit.
 plays.push({playedAt:'2027-07-18T14:00:00Z',artistName:artists[0],trackName:'Temporary Cities',albumName:'Invented Coast',importerProvenance:'fictional-fixture'});
 let scene=groundJourney({version:1,title:'Aurora Coast · fictional rehearsal',cues},{schemaVersion:1,source:'google-timeline',schemaEncountered:'fictional-fixture',importedAt:at,records},{schemaVersion:1,source:'lastfm-scrobbles',importedAt:at,records:plays},{from:'2027-07-18T00:00:00Z',toExclusive:'2027-07-28T00:00:00Z',timelineToExclusive:'2027-07-28T00:00:00Z',timeZone:'UTC',sources:[{type:'timeline',id:'fictional:aurora:timeline',fingerprint:'aurora-timeline-v1',capturedAt:at},{type:'lastfm',id:'fictional:aurora:listening',fingerprint:'aurora-listening-v1',capturedAt:at}]});
 scene.experience={regime:'TIME',memoryBase:'WORLD',fragmentDecisions:[{cueId:'aurora-afterimage',episodeId:'timeline-row-9',at,author:'Author',interpretation:'Composition only; no factual association inferred'}]};
 scene.evidenceArchive={version:1,scannedAt:at,windowCount:records.length,scannedRecords:3,skippedRecords:0,unmatchedArtefacts:0,artifacts:[
  {id:'fictional:score',kind:'notion',title:'Score for a temporary room',preview:['Leave a gap between each sound. Let the visitor choose when to cross it.','Invented notebook excerpt; an installation instruction, not a recovered memory.'],sourceId:'fictional:aurora:notebook',fingerprint:'aurora-notebook-v1',precision:'interval',start:records[0].startAt,end:records[0].endAt},
  {id:'fictional:calendar',kind:'calendar',title:'Projection test',preview:['An invented calendar appointment. A plan is not evidence of attendance.'],sourceId:'fictional:aurora:calendar',fingerprint:'aurora-calendar-v1',precision:'date',start:records[0].startAt.slice(0,10)},
  {id:'fictional:refused',kind:'author',title:'A proposed bridge',preview:['This imagined association was refused. It stays in the decision ledger.'],sourceId:'fictional:aurora:refusal',fingerprint:'aurora-refusal-v1',precision:'undated'}],matches:[
  {artifactId:'fictional:score',windowId:'timeline-row-0',basis:'explicit-source-link',status:'attached',explanation:'Explicit link inside the invented fixture.'},
  ...[0,1].map(i=>({artifactId:'fictional:calendar',windowId:`timeline-row-${i}`,basis:'date-only' as const,status:'candidate' as const,explanation:'Day-only calendar context; needs an Author decision.'})),
  {artifactId:'fictional:refused',windowId:'timeline-row-0',basis:'explicit-source-link',status:'candidate',explanation:'Proposed composition only.'}],decisions:[{artifactId:'fictional:refused',windowId:'timeline-row-0',decision:'refuse',author:'Author',at}],notes:['All source records and decisions in this preview are invented. Window 9 has geography only; it is intentionally sparse.']};
 scene=moveEpisodeSpace(scene,episodeSpaces(scene)[3],-2,2,'WORLD',at);
 scene=composeEpisodeSound(scene,'timeline-row-0',SOUND_CATALOG[0].id,['low','sustained'],'Fictional Author sound choice; not past listening.',at);
 return {scene:xrSceneSchema.parse(scene),decisions:Object.fromEntries(cues.map(c=>[c.id,'accepted' as const]))};
}
