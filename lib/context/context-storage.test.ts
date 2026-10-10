import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {openContextSandbox,putVaultRecords,readVaultRecord,closeVault,removeVaultRecords,setVaultAccessGuard} from '@/lib/vault/private-vault';
import {VaultSessionExpiredError} from '@/lib/vault/vault-session';
describe('encrypted context checkpoint boundary',()=>{
 it('rechecks write authorization immediately before replacement and preserves the disk on expiry',async()=>{
  const namespace=`context-sandbox-test-${randomUUID()}`;
  const directory=path.join(process.cwd(),'private-data',namespace);
  const vault=await openContextSandbox(namespace);
  try{
   putVaultRecords(vault,[{id:'preserved',kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:{fictional:true}}]);
   const file=path.join(directory,'scenario.sqlite'),before=readFileSync(file);
   let checks=0;
   setVaultAccessGuard(vault,()=>{if(++checks===2)throw new VaultSessionExpiredError();});
   expect(()=>putVaultRecords(vault,[{id:'denied',kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:{fictional:true}}])).toThrow(VaultSessionExpiredError);
   expect(checks).toBe(2);expect(readFileSync(file).equals(before)).toBe(true);
  }finally{closeVault(vault);rmSync(directory,{recursive:true,force:true});}
 });
 it('rejects a stale snapshot rather than overwriting another writer',async()=>{
  const namespace=`context-sandbox-test-${randomUUID()}`;
  const directory=path.join(process.cwd(),'private-data',namespace);
  let first:Awaited<ReturnType<typeof openContextSandbox>>|undefined,second:typeof first;
  try{
   first=await openContextSandbox(namespace);second=await openContextSandbox(namespace);
   putVaultRecords(first,[{id:'fictional-writer-one',kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:{note:'invented first write'}}]);
   expect(()=>putVaultRecords(second!,[{id:'fictional-writer-two',kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:{note:'invented stale write'}}])).toThrow('Vault changed');
   const fresh=await openContextSandbox(namespace);
   try {expect(readVaultRecord(fresh,'fictional-writer-one')).toBeDefined();expect(readVaultRecord(fresh,'fictional-writer-two')).toBeUndefined();}finally{closeVault(fresh);}
  }finally{if(first)closeVault(first);if(second)closeVault(second);rmSync(directory,{recursive:true,force:true});}
 });
 it('persists/reopens encrypted decisions and removes source copies without entering the personal Vault',async()=>{
  const namespace=`context-sandbox-test-${randomUUID()}`;
  const directory=path.join(process.cwd(),'private-data',namespace);
  try{
   let vault=await openContextSandbox(namespace);
   putVaultRecords(vault,[{id:'fictional-context-test',kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:{reflection:'unique-fictional-reflection-9c820',decision:'refused'}}]);
   closeVault(vault);
   expect(readFileSync(path.join(directory,'scenario.sqlite')).includes(Buffer.from('unique-fictional-reflection-9c820'))).toBe(false);
   vault=await openContextSandbox(namespace);
   expect(readVaultRecord(vault,'fictional-context-test')?.payload).toEqual({reflection:'unique-fictional-reflection-9c820',decision:'refused'});
   removeVaultRecords(vault,['fictional-context-test']);closeVault(vault);
   vault=await openContextSandbox(namespace);expect(readVaultRecord(vault,'fictional-context-test')).toBeUndefined();closeVault(vault);
  }finally{rmSync(directory,{recursive:true,force:true});}
 });
});
