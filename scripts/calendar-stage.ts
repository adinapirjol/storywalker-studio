/** Receives minimised connector results on stdin, never credentials or raw responses. */
import {mkdirSync,openSync,closeSync,writeFileSync,renameSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {calendarCatalogSchema,calendarEventSchema} from '../lib/automation/contracts';
import {readPrivateStage} from '../lib/automation/staged-files';

const folder=resolve('private-data/calendar');
const selectionSchema=z.object({version:z.literal(1),selectedAt:z.string(),events:z.array(z.object({key:z.string(),calendarId:z.string(),eventId:z.string()})).max(2000)});
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
    const fd=openSync(backup,'wx',0o600);try{writeFileSync(fd,readFileSync(join(folder,'candidates.private.json')));}finally{closeSync(fd);}
    const temp=join(folder,`update-${id}.tmp`);
    const out=openSync(temp,'wx',0o600);try{writeFileSync(out,JSON.stringify({...catalog,events:[...events.values()]}));}finally{closeSync(out);}
    if(JSON.stringify(selectionSchema.parse(readPrivateStage('calendar/selected.private.json')))!==stamp){rmSync(temp);throw Error('Selection changed');}
    renameSync(temp,join(folder,'candidates.private.json'));
    const receipt={at:new Date().toISOString(),selected:allowed.size,refreshed:input.events.length,unavailable:allowed.size-seen.size,vaultIngested:false};
    const receiptFile=openSync(join(folder,`receipt-${id}.private.json`),'wx',0o600);try{writeFileSync(receiptFile,JSON.stringify(receipt));}finally{closeSync(receiptFile);}
    console.log(JSON.stringify(receipt));
  }finally{rmSync(lock,{recursive:true});}
}
main().catch(()=>{console.error('Calendar staging failed; inspect selection, permissions and prior state before retrying.');process.exitCode=1;});
