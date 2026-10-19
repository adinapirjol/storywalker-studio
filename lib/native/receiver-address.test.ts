import {afterEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
vi.mock('node:os',async()=>({...await vi.importActual('node:os'),networkInterfaces:()=>({test:[{internal:false,family:'IPv4',address:'10.20.30.40'}]})}));
import {updateReceiverAddress,type ReceiverConfig} from './native-receiver';
import {openContextSandbox,closeVault,putVaultRecords,readVaultRecord,vaultRecordHeaders,type OpenVault} from '@/lib/vault/private-vault';
import {createVaultSession,deleteVaultSession} from '@/lib/vault/vault-session';
const namespace=`context-sandbox-address-${randomUUID()}`;
let vault:OpenVault|undefined,token:string|undefined;
afterEach(()=>{deleteVaultSession(token);if(vault)closeVault(vault);vault=undefined;rmSync(join('private-data',namespace),{recursive:true,force:true});});
it('repairs address and TLS binding while retaining queue identity, token and acceptance with encrypted backup',async()=>{
 vault=await openContextSandbox(namespace);token=createVaultSession(vault.key).token;
 const before:ReceiverConfig={version:1,id:'fictional-pair',host:'10.1.2.3',port:8766,mode:'healthkit',token:'fictional-token',certificate:'old-fixture',privateKey:'old-fixture',revoked:false,autoAcceptHealth:true};
 putVaultRecords(vault,[{id:'native:pairing:receiver',kind:'reference',capturedAt:new Date().toISOString(),payload:before}]);
 const generate=vi.fn(async()=>({...before,id:'discard-generated-id',token:'discard-generated-token',host:'10.20.30.40',certificate:'new-fixture',privateKey:'new-fixture'}));
 await expect(updateReceiverAddress(vault,token,'8.8.8.8',generate)).rejects.toThrow('INVALID_BIND');expect(generate).not.toHaveBeenCalled();
 await updateReceiverAddress(vault,token,'10.20.30.40',generate);
 expect(readVaultRecord(vault,'native:pairing:receiver')?.payload).toEqual({...before,host:'10.20.30.40',certificate:'new-fixture',privateKey:'new-fixture'});
 expect(vaultRecordHeaders(vault).filter(r=>r.id.startsWith('native:pairing:before-address:')).map(r=>readVaultRecord(vault!,r.id)?.payload)).toEqual([before]);
 await updateReceiverAddress(vault,token,'10.20.30.40',generate);expect(generate).toHaveBeenCalledTimes(1);
});
it('does not persist an address change if the session expires during certificate preparation',async()=>{
 vault=await openContextSandbox(namespace);token=createVaultSession(vault.key).token;
 const before={version:1,id:'fictional-pair',host:'10.1.2.3',port:8766,mode:'healthkit',revoked:false} as ReceiverConfig;
 putVaultRecords(vault,[{id:'native:pairing:receiver',kind:'reference',capturedAt:new Date().toISOString(),payload:before}]);
 await expect(updateReceiverAddress(vault,token,'10.20.30.40',async()=>{deleteVaultSession(token);return before;})).rejects.toThrow('VAULT_LOCKED');
 expect(readVaultRecord(vault,'native:pairing:receiver')?.payload).toEqual(before);
});
