import {NextRequest,NextResponse} from 'next/server';
import {isLocalSameOrigin} from '@/lib/http/local-origin';
import {boundedText} from '@/lib/http/context-request';
import {readVaultSession,VAULT_SESSION_COOKIE,assertVaultSessionActive,vaultSessionFailure} from '@/lib/vault/vault-session';
import {configureSummary,summaryStatus} from '@/lib/body/health-summary';
import {configureThreshold,thresholdStatus,setThresholdRest,testThresholdConnection} from '@/lib/body/health-threshold';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!isLocalSameOrigin(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
 const token=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
 const session=readVaultSession(token);
 if(!session)return json({code:'VAULT_LOCKED'},401);session.key.fill(0);
 try{
  const body=JSON.parse(await boundedText(request,2048));
  const check=()=>assertVaultSessionActive(token);check();
  if(body.action==='threshold-status'){const result=await thresholdStatus();check();return json(result);}
  if(body.action==='configure-threshold'&&typeof body.enabled==='boolean'&&(!body.enabled||body.policy==='unreviewed-live-v2'))return json(await configureThreshold(body.enabled,body.rule,check));
  if(body.action==='threshold-rest'&&typeof body.rest==='boolean'){check();const result=await setThresholdRest(body.rest);check();return json(result);}
  if(body.action==='threshold-test')return json(await testThresholdConnection(check));
  if(body.action==='status'){const result=await summaryStatus();check();return json(result);}
  if(body.action==='configure'&&typeof body.enabled==='boolean'&&(!body.enabled||body.policy==='reviewed-batch-v2'))return json(await configureSummary(body.enabled,check));
  return json({code:'INVALID_ACTION'},422);
 }catch(error){return vaultSessionFailure(error)??json({code:'SUMMARY_UNAVAILABLE'},422);}
}
