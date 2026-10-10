import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {isLocalSameOrigin,isLocalRead} from '@/lib/http/local-origin';
import {boundedText} from '@/lib/http/context-request';
import {vaultSessionActive,VAULT_SESSION_COOKIE,vaultSessionFailure} from '@/lib/vault/vault-session';
import {readVaultRecord,putVaultRecords} from '@/lib/vault/private-vault';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {xrSceneSchema} from '@/lib/xr/xr-scene';
import {buildVaultDemo} from '@/lib/vault/vault-demo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const selection=z.object({ids:z.array(z.string().max(500)).min(1).max(3),revision:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
async function respond(request:NextRequest,save:boolean){
 if(save&&!isLocalSameOrigin(request))return json({error:'Use the same local page.'},403);
 if(!isLocalRead(request))return json({error:'Local access required.'},403);
 const token=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 if(!vaultSessionActive(token))return json({code:'VAULT_LOCKED'},401);
 let input:z.infer<typeof selection>|undefined;
 if(save){try{input=selection.parse(JSON.parse(await boundedText(request,4096)));}catch{return json({error:'Choose one to three windows.'},422);}}
 try{return await withBrowserVault(token,vault=>{
  const record=readVaultRecord(vault,'xr:spatial-draft:v1');
  const parsed=xrSceneSchema.safeParse((record?.payload as {scene?:unknown}|undefined)?.scene);
  if(!parsed.success||!parsed.data.journeyLayout)return json({error:'An existing grounded private XR draft is required. No substitute history was created.'},409);
  const scene=parsed.data;
  const revision=createHash('sha256').update(JSON.stringify(scene)).digest('hex');
  if(input&&input.revision!==revision)return json({error:'Source draft changed. Reload the available windows.'},409);
  const saved=selection.safeParse(readVaultRecord(vault,'xr:subset-demo:v1')?.payload);
  const chosen=input ?? (saved.success&&saved.data.revision===revision?saved.data:undefined);
  const subset=chosen?buildVaultDemo(scene,chosen.ids):undefined;
  if(input)putVaultRecords(vault,[{id:'xr:subset-demo:v1',kind:'reference',capturedAt:new Date().toISOString(),payload:input}]);
  return json({revision,windows:(scene.journeyEpisodes??[]).slice(0,200).map(e=>({id:e.id,label:e.label,start:e.start,end:e.end,approximate:!!e.reconstructedTiming,contextCount:e.context.length+e.notionEvidence.length+(e.calendarEvidence?.length??0)})),selected:chosen?.ids??[],scene:subset,saved:!!chosen});
 });}catch(error){return vaultSessionFailure(error)??json({error:'The selected sources could not be prepared. No private details were logged.'},422);}
}
export const GET=(request:NextRequest)=>respond(request,false);
export const POST=(request:NextRequest)=>respond(request,true);
