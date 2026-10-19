import {afterEach,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {openContextSandbox,closeVault,putVaultRecords,readVaultRecord,type OpenVault} from '@/lib/vault/private-vault';
import {createVaultSession,deleteVaultSession} from '@/lib/vault/vault-session';
import {resumeSavedHealthReceiver} from '@/lib/native/native-receiver';

const namespace=`context-sandbox-resume-${randomUUID()}`;
let vault:OpenVault|undefined,token:string|undefined;
afterEach(()=>{deleteVaultSession(token);if(vault)closeVault(vault);vault=undefined;rmSync(join('private-data',namespace),{recursive:true,force:true});});
it('does not create or replace missing, revoked, fictional or moved pairings',async()=>{
  vault=await openContextSandbox(namespace);token=createVaultSession(vault.key).token;
  await expect(resumeSavedHealthReceiver(vault,token)).rejects.toThrow('PAIRING_REQUIRED');
  const config={version:1,revoked:true,mode:'healthkit',host:'203.0.113.1',autoAcceptHealth:false};
  const save=(payload:unknown)=>putVaultRecords(vault!,[{id:'native:pairing:receiver',kind:'reference',capturedAt:new Date().toISOString(),payload}]);
  save(config);await expect(resumeSavedHealthReceiver(vault,token)).rejects.toThrow('PAIRING_REQUIRED');
  save({...config,revoked:false,mode:'simulated'});await expect(resumeSavedHealthReceiver(vault,token)).rejects.toThrow('HEALTHKIT_PAIRING_REQUIRED');
  const moved={...config,revoked:false};save(moved);await expect(resumeSavedHealthReceiver(vault,token)).rejects.toThrow('ADDRESS_CHANGED');
  expect(readVaultRecord(vault,'native:pairing:receiver')?.payload).toEqual(moved);
  deleteVaultSession(token);await expect(resumeSavedHealthReceiver(vault,token)).rejects.toThrow('VAULT_LOCKED');
});
