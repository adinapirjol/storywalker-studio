import {nativeTransaction} from '@/lib/native/native-transaction';
import {resumeSavedHealthReceiver} from '@/lib/native/native-receiver';
import {receiverErrorCode} from '@/lib/native/receiver-errors';
import {withBrowserVault} from '@/lib/vault/vault-route-access';
import {putVaultRecords} from '@/lib/vault/private-vault';
import {syncSettings,ingestSelectedStages} from './private-sync';

/** Both authentication methods use this hook. Failures never undo a successful unlock. */
export async function syncAfterUnlock(token:string) {
  try {
    return await nativeTransaction(()=>withBrowserVault(token,async vault=>{
      const settings=syncSettings(vault);
      if(!settings.watch&&!settings.lastfm&&!settings.spotifyIds.length&&!settings.calendarKeys.length)return {watch:'disabled',results:[]};
      let watch='disabled';
      if(settings.watch) {
        try {await resumeSavedHealthReceiver(vault,token);watch='listening';}
        catch(error){watch=receiverErrorCode(error);}
      }
      const receipt=ingestSelectedStages(vault,settings);
      const result={...receipt,watch};
      putVaultRecords(vault,[{id:'automation:unlock-receipt:v1',kind:'reference',capturedAt:receipt.at,payload:result}]);
      return result;
    }));
  }catch{return {watch:'unavailable',results:[],status:'sync-unavailable'};}
}
