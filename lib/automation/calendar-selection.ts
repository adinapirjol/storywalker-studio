import {constants,closeSync,fsyncSync,mkdirSync,openSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {CalendarEvent} from './contracts';
import {readPrivateStage} from './staged-files';
import {z} from 'zod';

const manifestSchema=z.object({version:z.literal(1),selectedAt:z.string(),events:z.array(z.object({key:z.string(),calendarId:z.string(),eventId:z.string()})).max(2000)});
/** Only account lookup identities are staged for the collector, never credentials. */
export function exportCalendarSelection(keys:string[],candidates:CalendarEvent[]) {
  const folder=resolve('private-data/calendar');mkdirSync(folder,{recursive:true,mode:0o700});
  if(realpathSync(folder)!==folder)throw Error('UNSAFE_SELECTION_PATH');
  let previous:z.infer<typeof manifestSchema>['events']=[];
  try{previous=manifestSchema.parse(readPrivateStage('calendar/selected.private.json')).events;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const available=new Map([...previous,...candidates].map(e=>[e.key,e]));
  const events=keys.map(key=>{const e=available.get(key);if(!e)throw Error('SELECTION_UNAVAILABLE');return {key:e.key,calendarId:e.calendarId,eventId:e.eventId};});
  const temporary=resolve(folder,`selection-${randomUUID()}.tmp`);
  const fd=openSync(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,JSON.stringify({version:1,selectedAt:new Date().toISOString(),events}));fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temporary,resolve(folder,'selected.private.json'));
}
