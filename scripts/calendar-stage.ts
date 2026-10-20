/** Receives minimised connector results on stdin, never credentials or raw responses. */
import {mkdirSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {calendarCatalogSchema,calendarEventSchema} from '../lib/automation/contracts';
import {readPrivateStage} from '../lib/automation/staged-files';
import {writePrivateExclusive,replacePrivateStage,syncPrivateDirectory,StageCommitUncertain} from '../lib/automation/durable-stage';

const folder=resolve('private-data/calendar');
const selectionSchema=z.object({version:z.literal(1),selectedAt:z.string(),events:z.array(z.object({key:z.string(),calendarId:z.string(),eventId:z.string()})).max(2000)});
let catalogSaved=false;
async function main(){
  mkdirSync(folder,{recursive:true,mode:0o700});
  if(realpathSync(folder)!==folder)throw Error('Unsafe folder');
  const lock=join(folder,'collection.lock');mkdirSync(lock,{mode:0o700});
  try{
    const selection=selectionSchema.parse(readPrivateStage('calendar/selected.private.json'));
    const stamp=JSON.stringify(selection);
    const chunks:Buffer[]=[];let bytes=0;
    for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>16_000_000)throw Error('Input limit');chunks.push(Buffer.from(chunk));}
    const input=z.object({events:z.array(calendarEventSchema).max(2000),unavailable:z.array(z.string()).max(2000)}).strict().parse(JSON.parse(Buffer.concat(chunks).toString()));
    const allowed=new Map(selection.events.map(e=>[e.key,e]));
    const seen=new Set<string>();
    for(const event of input.events){
      const selected=allowed.get(event.key);
      const key=createHash('sha256').update(JSON.stringify([event.calendarId,event.eventId])).digest('hex');
      if(!selected||key!==event.key||selected.calendarId!==event.calendarId||selected.eventId!==event.eventId||seen.has(key)||Date.parse(event.fetchedAt)>Date.now()+60_000)throw Error('Invalid scope');
      seen.add(key);
    }
    if(input.unavailable.some(key=>!allowed.has(key)||seen.has(key)))throw Error('Invalid gap');
    const catalog=calendarCatalogSchema.parse(readPrivateStage('calendar/candidates.private.json'));
    const events=new Map(catalog.events.map(e=>[e.key,e]));
    for(const event of input.events){const old=events.get(event.key);if(old&&Date.parse(old.fetchedAt)>Date.parse(event.fetchedAt))throw Error('Older update');events.set(event.key,event);}
    if(JSON.stringify(selectionSchema.parse(readPrivateStage('calendar/selected.private.json')))!==stamp)throw Error('Selection changed');
    const id=new Date().toISOString().replaceAll(':','-')+'-'+randomUUID();
    const backup=join(folder,`before-${id}.private.json`);
    writePrivateExclusive(backup,readFileSync(join(folder,'candidates.private.json')));
    replacePrivateStage(folder,'candidates.private.json',JSON.stringify({...catalog,events:[...events.values()]}),()=>{
      if(JSON.stringify(selectionSchema.parse(readPrivateStage('calendar/selected.private.json')))!==stamp)throw Error('Selection changed');
    });
    catalogSaved=true;
    const receipt={at:new Date().toISOString(),selected:allowed.size,refreshed:input.events.length,unavailable:allowed.size-seen.size,vaultIngested:false};
    writePrivateExclusive(join(folder,`receipt-${id}.private.json`),JSON.stringify(receipt));
    syncPrivateDirectory(folder);
    console.log(JSON.stringify(receipt));
  }finally{rmSync(lock,{recursive:true});}
}
main().catch(error=>{
  const message=error instanceof StageCommitUncertain
    ? 'Calendar catalog replacement occurred; durability could not be confirmed. Inspect saved state before retrying.'
    : catalogSaved?'Calendar catalog saved; the collection receipt could not finish. Inspect saved state before retrying.'
    : 'Calendar staging failed; inspect selection, permissions and prior state before retrying.';
  console.error(message);process.exitCode=1;
});
