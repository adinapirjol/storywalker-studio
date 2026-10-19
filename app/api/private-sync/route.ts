import {exportCalendarSelection} from '@/lib/automation/calendar-selection';
import {exportSpotifySelection} from '@/lib/automation/spotify-selection';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {isLocalSameOrigin} from '@/lib/http/local-origin';
import {boundedText} from '@/lib/http/context-request';
import {VAULT_SESSION_COOKIE,vaultSessionActive,vaultSessionFailure} from '@/lib/vault/vault-session';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {nativeTransaction} from '@/lib/native/native-transaction';
import {putVaultRecords,readVaultRecord} from '@/lib/vault/private-vault';
import {syncSettingsSchema} from '@/lib/automation/contracts';
import {calendarCandidates,ingestSelectedStages,musicChoices,settingsId,syncSettings,receiptId} from '@/lib/automation/private-sync';
import {syncAfterUnlock} from '@/lib/automation/unlock-sync';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('status')}).strict(),
  z.object({action:z.literal('poll')}).strict(),
  z.object({action:z.literal('run')}).strict(),
  z.object({action:z.literal('save'),settings:syncSettingsSchema}).strict(),
]);
export async function POST(request:NextRequest){
  if(!isLocalSameOrigin(request))return json({code:'LOCAL_ORIGIN_REQUIRED'},403);
  const token=request.cookies.get(VAULT_SESSION_COOKIE)?.value;
  if(!vaultSessionActive(token))return json({code:'VAULT_LOCKED'},401);
  try {
    const body=schema.parse(JSON.parse(await boundedText(request,160_000)));
    if(body.action==='run')return json(await syncAfterUnlock(token!,request.signal));
    return await nativeTransaction(()=>withBrowserVault(token,vault=>{
      if(body.action==='poll')return json(ingestSelectedStages(vault,syncSettings(vault)));
      let catalog;try{catalog=calendarCandidates();}catch{catalog=undefined;}
      const choices=musicChoices(vault),settings=syncSettings(vault);
      if(body.action==='save'){
        const permittedMusic=new Set(choices.map(c=>c.id));
        const permittedCalendar=new Set([...(catalog?.events.map(e=>e.key)??[]),...settings.calendarKeys]);
        if(body.settings.spotifyIds.some(id=>!permittedMusic.has(id))||body.settings.calendarKeys.some(key=>!permittedCalendar.has(key)))return json({code:'SELECTION_UNAVAILABLE'},422);
        exportSpotifySelection([]);
        exportCalendarSelection([],catalog?.events??[]);
        putVaultRecords(vault,[{id:settingsId,kind:'reference',capturedAt:new Date().toISOString(),payload:body.settings}]);
        const warnings:string[]=[];
        try {exportCalendarSelection(body.settings.calendarKeys,catalog?.events??[]);} catch {warnings.push('Calendar collector selection export failed.');}
        try {exportSpotifySelection(body.settings.spotifyIds);} catch {warnings.push('Spotify collector selection export failed.');}
        return json({saved:true,...(warnings.length?{warning:`Choices saved in Vault. ${warnings.join(' ')} Reload and save again.`}:{})});
      }
      return json({settings,choices,catalog,receipt:readVaultRecord(vault,receiptId)?.payload,unlockReceipt:readVaultRecord(vault,'automation:unlock-receipt:v1')?.payload});
    },request.signal));
  }catch(error){
    if(error instanceof z.ZodError)return json({code:'INVALID_SYNC_CHOICES'},422);
    return vaultSessionFailure(error)??json({code:'SYNC_UNAVAILABLE'},422);
  }
}
