import {nativeTransaction} from '@/lib/native/native-transaction';
import {resumeSavedHealthReceiver,stopReceiverForSession} from '@/lib/native/native-receiver';
import {receiverErrorCode} from '@/lib/native/receiver-errors';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {putVaultRecords} from '@/lib/vault/private-vault';
import {syncSettings,ingestSelectedStages} from './private-sync';

/** Called after the browser receives its cookie, never inside authentication. */
export async function syncAfterUnlock(token:string,signal?:AbortSignal) {
  let evidenceSaved=false;
  try {
    return await nativeTransaction(()=>withBrowserVault(token,async (vault,check)=>{
      check();
      const settings=syncSettings(vault);
      if(!settings.watch&&!settings.lastfm&&!settings.spotifyIds.length&&!settings.calendarKeys.length)return {watch:'disabled',results:[]};
      let watch='disabled';
      if(settings.watch) {
        try {await resumeSavedHealthReceiver(vault,token);watch='listening';}
        catch(error){watch=receiverErrorCode(error);}
      }
      check();
      const receipt=ingestSelectedStages(vault,settings);
      evidenceSaved=receipt.results.some(r=>r.status==='saved'||r.changed);
      const result={...receipt,watch};
      try {putVaultRecords(vault,[{id:'automation:unlock-receipt:v1',kind:'reference',capturedAt:receipt.at,payload:result}]);}
      catch {return {...result,warning:'Source results above are confirmed. The unlock receipt could not be saved; reload before retrying.'};}
      return result;
    },signal));
  }catch{
    // No private results are released after cancellation or the final access check.
    await stopReceiverForSession(token);
    return evidenceSaved?{watch:'unavailable',results:[],status:'saved-reload-required'}:
      {watch:'unavailable',results:[],status:signal?.aborted?'sync-cancelled':'sync-unavailable'};
  }
}
