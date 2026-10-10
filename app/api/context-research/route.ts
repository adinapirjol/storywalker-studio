import {isLocalSameOrigin,isLocalRead} from '@/lib/http/local-origin';
import { NextRequest, NextResponse } from 'next/server';
import { closeVault, openContextSandbox, putVaultRecords, readVaultRecord } from '@/lib/vault/private-vault';
import { randomBytes } from 'node:crypto';
import {boundedText} from '@/lib/http/context-request';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let queue: Promise<unknown> = Promise.resolve();
const sessions=new Map<string,number>();
const sessionCookie="storywalker_context_sandbox";
function token() {
  const dir = path.join(process.cwd(), 'private-data', 'context-service');
  mkdirSync(dir, {recursive:true, mode:0o700});
  const file = path.join(dir,'token');
  if (!existsSync(file)) writeFileSync(file,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
  return readFileSync(file,'utf8');
}
async function processCommand(command: unknown) {
  const vault = await openContextSandbox();
  try {
    const state = readVaultRecord(vault,'context:scenario:v1')?.payload ?? null;
    const response = await fetch('http://127.0.0.1:8765/context/process', {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`},body:JSON.stringify({state,command}),signal:AbortSignal.timeout(10000),cache:'no-store'});
    if (!response.ok) return NextResponse.json({error:response.status===409?'This evidence changed. Refresh and review the current version.':'The processor could not validate this action.'},{status:response.status});
    const result = await response.json();
    putVaultRecords(vault,[{id:'context:scenario:v1',kind:'scenario-studio',capturedAt:new Date().toISOString(),payload:result}]);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } finally { closeVault(vault); }
}
export async function GET(request:NextRequest) {
  if(!isLocalRead(request))return NextResponse.json({error:"Same-origin access required"},{status:403});
  for(const [id,expires] of sessions)if(expires<Date.now())sessions.delete(id);
  const supplied=request.cookies.get(sessionCookie)?.value;
  const session=supplied&&sessions.has(supplied)?supplied:randomBytes(32).toString("hex");
  sessions.set(session,Date.now()+15*60*1000);
  const vault=await openContextSandbox();
  try {const response=NextResponse.json(readVaultRecord(vault,'context:scenario:v1')?.payload ?? null,{headers:{'Cache-Control':'no-store'}});response.cookies.set(sessionCookie,session,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:900});return response;}
  finally {closeVault(vault);}
}
export async function POST(request:NextRequest) {
  if (!isLocalSameOrigin(request)) return NextResponse.json({error:'Same-origin action required.'},{status:403});
  const session=request.cookies.get(sessionCookie)?.value;
  if(!session||(sessions.get(session)??0)<Date.now())return NextResponse.json({error:"Refresh the scenario session."},{status:401});
  let raw:string;try{raw=await boundedText(request,8192);}catch{return NextResponse.json({error:'Action too large or malformed.'},{status:413});}
  let command:unknown;
  try { command=JSON.parse(raw); } catch {return NextResponse.json({error:'Invalid action.'},{status:422});}
  const task=queue.then(()=>processCommand(command));
  queue=task.catch(()=>undefined);
  try {return await task;} catch {return NextResponse.json({error:'Local processor unavailable. Start the research service.'},{status:503});}
}
