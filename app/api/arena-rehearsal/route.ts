import {isLocalSameOrigin} from '@/lib/http/local-origin';
import {boundedText} from '@/lib/http/context-request';
import {cookies} from 'next/headers';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {vaultSessionActive,VAULT_SESSION_COOKIE,assertVaultSessionActive,vaultSessionFailure} from '@/lib/vault/vault-session';
import {readVaultRecord,putVaultRecords} from '@/lib/vault/private-vault';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {arenaRehearsalSchema,validateArenaComposition} from '@/lib/arena/arena-rehearsal';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id='arena:private-rehearsal:v1';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!isLocalSameOrigin(request))return reply({error:'Use this page from the same Storywalker origin.'},403);
 const token=(await cookies()).get(VAULT_SESSION_COOKIE)?.value;
 if(!vaultSessionActive(token))return reply({code:'VAULT_LOCKED',error:'Unlock to open your private reference field.'},401);
 try{return await withBrowserVault(token,async vault=>{
  const input=JSON.parse(await boundedText(request,65_536));if(!['load','save'].includes(input.action))return reply({error:'Unknown action'},400);
  assertVaultSessionActive(token);
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
 });}catch(error){return vaultSessionFailure(error)??reply({error:'The private reference field could not be loaded or saved. Existing evidence is preserved.'},400);}
}
