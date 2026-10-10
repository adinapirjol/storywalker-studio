import {z} from 'zod';
import type {XRScene,Decision} from './xr-scene';
export const archiveArtifactSchema=z.object({
 id:z.string(),kind:z.enum(['timeline','lastfm','calendar','notion','media','vault','author']),title:z.string().max(500),preview:z.array(z.string().max(1400)).max(12),sourceId:z.string(),fingerprint:z.string(),
 start:z.string().optional(),end:z.string().optional(),precision:z.enum(['instant','interval','date','undated']),
 thumbnail:z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(180000).optional(),
}).strict();
export const evidenceArchiveSchema=z.object({
 version:z.literal(1),scannedAt:z.string().datetime(),windowCount:z.number().int(),scannedRecords:z.number().int(),skippedRecords:z.number().int(),unmatchedArtefacts:z.number().int(),
 artifacts:z.array(archiveArtifactSchema),
 matches:z.array(z.object({artifactId:z.string(),windowId:z.string(),basis:z.enum(['explicit-source-link','unique-contained-time','ambiguous-time','date-only','uncertain-boundary']),status:z.enum(['attached','candidate']),explanation:z.string()}).strict()),
 decisions:z.array(z.object({artifactId:z.string(),windowId:z.string(),decision:z.enum(['accept','refuse','reconsider']),author:z.literal('Author'),at:z.string().datetime()}).strict()),
 notes:z.array(z.string()),
}).strict();
export type ArchiveArtifact=z.infer<typeof archiveArtifactSchema>;
export type EvidenceArchive=z.infer<typeof evidenceArchiveSchema>;
export type WindowEvidence={windowId:string;label:string;start:string;end:string;durationHours:number;approximate:boolean;artifacts:ArchiveArtifact[];candidates:number};
export function windowEvidence(scene:XRScene,decisions:Record<string,Decision>):WindowEvidence[]{
 const archive=scene.evidenceArchive;
 const byId=new Map(archive?.artifacts.map(a=>[a.id,a])??[]);
 return (scene.journeyEpisodes??[]).map(e=>{
  const artifacts:ArchiveArtifact[]=[];
  const geography=e.provenance.nodes.find(n=>e.worldPosition?.evidenceIds.includes(n.id));
  if(geography)artifacts.push({id:`window:${e.id}`,kind:geography.type==='timeline'?'timeline':'author',title:geography.type==='timeline'?'Recorded Timeline window':'Author itinerary window',sourceId:geography.sourceId,fingerprint:e.worldPosition!.projection,precision:e.reconstructedTiming?'date':'interval',start:e.start,end:e.end,preview:[e.label,`${e.start} → ${e.end}`,geography.type==='timeline'?`Source certainty: ${geography.certainty}. A recorded interval, not an inferred event.`:geography.type==='author'?geography.statement:'Source-linked geography',...(e.reconstructedTiming?[e.reconstructedTiming.note]:[])]});
  if(e.listening?.count){const p=e.listening;artifacts.push({id:`listening:${e.id}`,kind:'lastfm',title:`${p.count} timestamp-aligned scrobbles`,sourceId:p.sourceId,fingerprint:scene.journeyLayout?.sources.find(s=>s.type==='lastfm')?.fingerprint??'existing-profile',precision:'interval',start:e.start,end:e.end,preview:[...p.artists.slice(0,3).map(a=>`${a.label} · ${a.count} plays`),...p.tracks.slice(0,2).map(a=>`${a.label} · ${a.count} plays`),'Listening observations only; no emotional or autobiographical interpretation.']});}
  // Existing explicit attachments are usable before a fresh enrichment pass.
  if(!archive){for(const page of e.notionEvidence)artifacts.push({id:`notion:${page.pageId}`,kind:'notion',title:page.title,sourceId:page.pageId,fingerprint:'existing-provenance',precision:'date',start:page.date,preview:[page.contentSummary??'No source summary available.','Notion context; not physical presence.']});
   // Calendar links are classified by the enrichment pass before display.
  }
  let candidates=0;
  for(const match of archive?.matches.filter(m=>m.windowId===e.id)??[]){
   const choice=[...archive!.decisions].reverse().find(d=>d.windowId===e.id&&d.artifactId===match.artifactId)?.decision;
   const attach=choice==='accept'||(!choice&&match.status==='attached');
   if(attach){const a=byId.get(match.artifactId);if(a)artifacts.push({...a,preview:[...a.preview.slice(0,10),`Match: ${match.basis}. ${match.explanation}`,...(choice==='accept'?['Association explicitly selected by the Author; not proof of occurrence.']:[])]});}
   else if(choice!=='refuse')candidates++;
  }
  for(const cue of scene.cues.filter(c=>c.source==='author'&&decisions[c.id]==='accepted')){
   const placement=[...(scene.experience?.fragmentDecisions??[])].reverse().find(d=>d.cueId===cue.id);
   if(placement?.episodeId===e.id)artifacts.push({id:`fragment:${cue.id}`,kind:'author',title:cue.title,sourceId:cue.evidence?.sourceId??cue.provenance,fingerprint:placement.at,precision:'undated',preview:[...(cue.evidence?.facts??[]).slice(0,8),'Explicit Author composition in this window. This is not a dated viewing/event claim.']});
  }
  return {windowId:e.id,label:e.label,start:e.start,end:e.end,durationHours:(Date.parse(e.end)-Date.parse(e.start))/3600000,approximate:!!e.reconstructedTiming,artifacts,candidates};
 });
}
/** Duration is depth, capped and logged; width and height are fixed. */
export function windowDepth(hours:number,approximate=false){return approximate? .45:Math.min(2.4,.3+Math.log2(1+Math.max(0,hours))*.25);}
export function evidenceMatchAttached(archive:EvidenceArchive,artifactId:string,windowId:string){const m=archive.matches.find(m=>m.artifactId===artifactId&&m.windowId===windowId);const d=[...archive.decisions].reverse().find(d=>d.artifactId===artifactId&&d.windowId===windowId);return d?d.decision==='accept':m?.status==='attached';}
