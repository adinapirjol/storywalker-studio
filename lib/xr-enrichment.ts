import {createHash} from 'node:crypto';
import type {VaultRecord} from './private-vault';
import type {XRScene} from './xr-scene';
import {evidenceArchiveSchema,type ArchiveArtifact,type EvidenceArchive} from './xr-evidence';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:undefined;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const instant=(v?:string)=>v&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):NaN;
const day=(v:string,tz:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const validDay=(v:string)=>/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function eligibleArchiveRecord(h:Pick<VaultRecord,'id'|'kind'>){return ['import','capture','moment','reference'].includes(h.kind)&&!/(?:^xr:|^lastfm:|:before|:snapshot:|timeline-chunk|spotify)/i.test(h.id);}
/** Explicit field adapters only. Never use ingestion/capture/edit time as event time,
 * never semantic search, and never fetch a remote thumbnail or URL. */
export function enrichWindowEvidence(scene:XRScene,records:VaultRecord[],scannedAt=new Date().toISOString()):EvidenceArchive{
 const artifacts:ArchiveArtifact[]=[],matches:EvidenceArchive['matches']=[];
 const episodes=scene.journeyEpisodes??[];let skippedRecords=0,unmatchedArtefacts=0,thumbnailBytes=0;
 function add(row:Record<string,unknown>,sourceId:string,kind:ArchiveArtifact['kind'],explicitIds:string[]=[],fingerprint=hash(row)){
  const when=object(row.when),exif=object(row.exif);
  let start=str(row.startsWhen)??str(row.occurredAt)??str(row.watchedWhen)??str(when.start)??str(row.date)??str(row.when);
  let end=str(row.endsWhen)??str(when.end);
  if(kind==='media'){
   start=str(exif.DateTimeOriginal)??str(row.takenAt)??start;
   if(start&&/^\d{4}:\d\d:\d\d /.test(start))start=start.slice(0,10).replaceAll(':','-')+'T'+start.slice(11);
   if(start&&!/(?:Z|[+-]\d\d:\d\d)$/.test(start)&&str(exif.OffsetTimeOriginal))start+=str(exif.OffsetTimeOriginal);
  }
  const from=instant(start),finish=instant(end),date=start?.slice(0,10);
  if(!Number.isFinite(from)&&!validDay(date??''))start=undefined;
  if(end&&!Number.isFinite(finish)&&!validDay(end))end=undefined;
  const title=(str(row.title)??str(row.name)??(kind==='media'?'Media / EXIF record':'Untitled source record')).slice(0,500);
  const id=`artifact:${hash({sourceId,fingerprint}).slice(0,24)}`;
  if(artifacts.some(a=>a.id===id))return;
  const preview=[str(row.contentSummary)??str(row.description)??str(row.evidence)??str(row.note)??str(row.statement)].filter((s):s is string=>!!s).map(s=>s.slice(0,700));
  if(start)preview.push(`${start}${end?' → '+end:''}`);
  if(str(row.status))preview.push(`Source status: ${str(row.status)}`);
  preview.push(kind==='calendar'?'Scheduling evidence only; attendance is not established.':kind==='notion'?'Notion context only; page location is not physical geography.':kind==='media'?'Media metadata describes the artefact; no depicted event is inferred.':'Source-recorded context; no undocumented event is inferred.');
  const explicit=episodes.filter(e=>explicitIds.includes(e.id)||(kind!=='calendar'&&e.provenance.nodes.some(n=>n.sourceId===sourceId)));
  const possible=explicit.length?explicit:episodes.filter(e=>{
   if(Number.isFinite(from))return Number.isFinite(finish)&&finish>from?from<Date.parse(e.end)&&finish>Date.parse(e.start):from>=Date.parse(e.start)&&from<Date.parse(e.end);
   if(!start||!date)return false;
   const last=row.allDay===true&&end&&validDay(end)?new Date(Date.parse(end)-86400000).toISOString().slice(0,10):date;
   return date<=day(new Date(Date.parse(e.end)-1).toISOString(),e.timeZone)&&last>=day(e.start,e.timeZone);
  });
  if(!possible.length){unmatchedArtefacts++;return;}
  const thumbnail=str(row.thumbnailDataUrl);let embedded:string|undefined;
  if(kind==='media'&&thumbnail&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(thumbnail)&&thumbnail.length<=180000&&thumbnailBytes+thumbnail.length<=1000000){embedded=thumbnail;thumbnailBytes+=thumbnail.length;}
  artifacts.push({id,kind,title,preview,sourceId,fingerprint,...(start?{start}:{}),...(end?{end}:{}),precision:Number.isFinite(from)?Number.isFinite(finish)?'interval':'instant':start?'date':'undated',...(embedded?{thumbnail:embedded}:{})});
  for(const e of possible){
   const stop=Number.isFinite(finish)?finish:from+1;
   const contained=Number.isFinite(from)&&from>=Date.parse(e.start)&&stop<=Date.parse(e.end)&&stop>from;
   const conservative=!e.reconstructedTiming||e.reconstructedTiming.listeningWindows.some(w=>from>=Date.parse(w.start)&&stop<=Date.parse(w.end));
   const basis:EvidenceArchive['matches'][number]['basis']=explicit.length?'explicit-source-link':!Number.isFinite(from)?'date-only':!conservative?'uncertain-boundary':possible.length===1&&contained?'unique-contained-time':'ambiguous-time';
   matches.push({artifactId:id,windowId:e.id,basis,status:basis==='explicit-source-link'||basis==='unique-contained-time'?'attached':'candidate',explanation:basis==='explicit-source-link'?'Existing explicit window/source provenance.':basis==='unique-contained-time'?'Source time is fully contained in one conservative window; contextual association, not attendance.':basis==='date-only'?'Date-only or floating local time; no precise temporal association.':basis==='uncertain-boundary'?'Author date envelope or transit boundary; exact location/time remains uncertain.':`Source interval overlaps ${possible.length} possible window(s), or extends beyond the window.`});
  }
 }
 for(const record of records){
  if(!eligibleArchiveRecord(record)){skippedRecords++;continue;}
  const p=object(record.payload),document=object(p.document),source=str(document.source)??str(p.source)??'';
  if(/spotify|google-timeline|lastfm-scrobbles|google-maps/.test(source)){skippedRecords++;continue;}
  if(source==='research-session'){if(typeof p.sourceWindowId==='string')add({...p,contentSummary:`Author-composed research association, not event or attendance evidence. ${str(p.description)??''}`},record.id,'author',[p.sourceWindowId]);else skippedRecords++;continue;}
  const rows=Array.isArray(document.records)?document.records:[];
  if(rows.length){
   if(!['google-calendar-takeout','youtube-watch-history','media-exif','photo-exif'].includes(source)){skippedRecords++;continue;}
   rows.forEach((r,i)=>add(object(r),`${record.id}#records/${i}`,source==='google-calendar-takeout'?'calendar':/exif/.test(source)?'media':'vault'));
  }else{
   const row=record.kind==='moment'?object(p.moment):p.record?object(p.record):p;
   const explicitIds=[str(row.sourceWindowId),str(row.episodeId),...(Array.isArray(row.sourceWindowIds)?row.sourceWindowIds.filter((v):v is string=>typeof v==='string'):[])].filter((s):s is string=>!!s);
   add(row,record.id,row.exif||row.takenAt?'media':'vault',explicitIds);
  }
 }
 for(const page of scene.notionContext?.records??[]){
  // A retained Notion provenance node is an existing explicit context link. Pending
  // whole-day candidates stay pending; never upgrade them from similarity.
  const linked=episodes.filter(e=>e.notionEvidence.some(p=>p.pageId===page.evidence.pageId)).map(e=>e.id);
  add({...page.evidence,title:page.evidence.title},`notion:${page.evidence.pageId}`,'notion',linked,page.source.fingerprint);
 }
 const previous=scene.evidenceArchive;
 const decisions=(previous?.decisions??[]).filter(d=>matches.some(m=>m.artifactId===d.artifactId&&m.windowId===d.windowId));
 return evidenceArchiveSchema.parse({version:1,scannedAt,windowCount:episodes.length,scannedRecords:records.length,skippedRecords,unmatchedArtefacts,artifacts,matches,decisions,notes:[
  'Timeline windows, exact Last.fm profiles and explicit Author fragment placements are read directly from the scene; no source data is rewritten.',
  'Only existing explicit source links or unique fully contained offset timestamps attach automatically. Date-only, multi-window and uncertain-boundary candidates require Author review.',
  'No semantic matching. Ingestion, modification and Vault capture timestamps are not event dates. Unsupported records remain unassigned.',
  'Only embedded, bounded raster thumbnails already in the Vault can preview; no remote media requests, local path reads or generated filler.',
  'A chamber is an archival composition, never a reconstruction of a physical place.'
 ]});
}
