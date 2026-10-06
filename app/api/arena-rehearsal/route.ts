import {cookies} from 'next/headers';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {readVaultSession,VAULT_SESSION_COOKIE} from '@/lib/vault-session';
import {openVaultWithKey,closeVault,readVaultRecord,putVaultRecords} from '@/lib/private-vault';
import {arenaRehearsalSchema,validateArenaComposition} from '@/lib/arena-rehearsal';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id='arena:private-rehearsal:v1';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Use this page from the same Storywalker origin.'},403);
 const session=readVaultSession((await cookies()).get(VAULT_SESSION_COOKIE)?.value);
 if(!session)return reply({code:'VAULT_LOCKED',error:'Unlock to open your private reference field.'},401);
 const vault=await openVaultWithKey(session.key);
 try{
  const input=await request.json();if(!['load','save'].includes(input.action))return reply({error:'Unknown action'},400);
  const staged=join(process.cwd(),'private-data','arena-rehearsal','staged.json');
  let record=readVaultRecord(vault,id);
  if(input.action==='load'&&existsSync(staged)){
   const snapshot=arenaRehearsalSchema.parse(JSON.parse(readFileSync(staged,'utf8')));
   // A refreshed source does not erase the previous composition or evidence.
   const archive=record?{...record,id:`${id}:archive:${new Date().toISOString()}`}:undefined;
   record={id,kind:'reference',capturedAt:snapshot.capturedAt,payload:{snapshot,composition:{selected:[],hidden:[],note:''},decisions:[],canonical:false}};
   putVaultRecords(vault,[...(archive?[archive]:[]),record]);unlinkSync(staged); // only after encrypted persistence succeeds
  }
  if(!record)return reply({error:'No private Are.na snapshot is staged yet. Refresh through the configured read-only MCP tools.'},404);
  const payload=record.payload as {snapshot:unknown;composition:unknown;decisions:unknown[]};
  const snapshot=arenaRehearsalSchema.parse(payload.snapshot);
  if(input.action==='save'){
   const composition=validateArenaComposition(input.composition,snapshot),savedAt=new Date().toISOString();
   putVaultRecords(vault,[{...record,payload:{...payload,composition,decisions:[...(payload.decisions??[]),{at:savedAt,author:'Author',composition,basis:'Authored juxtaposition; no semantic or autobiographical inference'}],canonical:false}}]);return reply({savedAt});
  }
  return reply({snapshot,composition:validateArenaComposition(payload.composition,snapshot)});
 }catch{return reply({error:'The private reference field could not be loaded or saved. Existing evidence is preserved.'},400);}finally{closeVault(vault);}
}
