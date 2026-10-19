import {it,expect,vi} from 'vitest';
import {mkdtempSync,symlinkSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {researchPayload} from './research-session';
it('saves encrypted snapshots, reloads decisions and retrieves them without touching the real Vault',async()=>{
 const root=process.cwd(),dir=mkdtempSync(path.join(tmpdir(),'storywalker-research-test-'));
 symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'));
 const cwd=vi.spyOn(process,'cwd').mockReturnValue(dir);
 try{
  vi.resetModules();const vaultApi=await import('@/lib/vault/private-vault');
  const passphrase='Synthetic test credential only';await vaultApi.initialiseVault(passphrase);
  let vault=await vaultApi.openVault(passphrase);
  const fact={id:'accepted-fact:fixture',kind:'capture' as const,capturedAt:'2026-10-13T00:00:00Z',payload:{reviewStatus:'accepted',evidence:'Fictional factual trace'}};
  vaultApi.putVaultRecords(vault,[fact]);
  const {saveResearchSnapshot}=await import('./research-persistence');
  const session={study:'refusal' as const,title:'Fictional revisit',note:'Unresolved',entries:[{action:'unresolved',subject:'fiction'}],mode:'fictional' as const,sourceContext:''};
  const first=saveResearchSnapshot(vault,session,'00000000-0000-4000-8000-000000000001');
  vaultApi.closeVault(vault);vault=await vaultApi.openVault(passphrase);
  expect(saveResearchSnapshot(vault,session,'00000000-0000-4000-8000-000000000001')).toEqual({...first,duplicate:true});
  expect(()=>saveResearchSnapshot(vault,{...session,note:'Changed'},'00000000-0000-4000-8000-000000000001')).toThrow('different reading');
  expect(vaultApi.readVaultRecord(vault,first.id)?.payload).toMatchObject({note:'Unresolved',canonical:false});
  const second=saveResearchSnapshot(vault,{...session,note:'Changed'},'00000000-0000-4000-8000-000000000002');
  expect(second.id).not.toBe(first.id);
  expect(vaultApi.readVaultRecord(vault,fact.id)).toEqual(fact);
  const payload=researchPayload({study:'refusal',title:'Fictional rehearsal',note:'A preserved boundary',entries:[{action:'refuse',subject:'fictional proposal',wording:'Retained editorial constraint'}],mode:'fictional'},'2026-09-29T00:00:00Z');
  vaultApi.putVaultRecords(vault,[{id:'research-session:test',kind:'capture',capturedAt:payload.researchRecordedAt,payload}]);vaultApi.closeVault(vault);
  expect(readFileSync(path.join(dir,'private-data/vault/storywalker-vault.sqlite')).includes(Buffer.from('Retained editorial constraint'))).toBe(false);
  vault=await vaultApi.openVault(passphrase);expect(vaultApi.readVaultRecord(vault,'research-session:test')?.payload).toEqual(payload);expect(vaultApi.searchVault(vault,'editorial')).toHaveLength(3);vaultApi.closeVault(vault);
 }finally{cwd.mockRestore();rmSync(dir,{recursive:true,force:true});}
});
