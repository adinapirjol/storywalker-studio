/** Fictional interoperability check. Never opens the personal Vault. */
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {decodeTransfer,validateNativePacket,stageNativeTransfer,decideNativeTransfer,nativeReceipt,previewNativeTransfer} from '../lib/native/native-transfer';
import {openContextSandbox,closeVault} from '../lib/vault/private-vault';
async function main(){
 const folder=process.argv[2];if(!folder)throw Error();
 const key=readFileSync(path.join(folder,'fictional-test-key.txt'),'utf8');
 const decoded=decodeTransfer(readFileSync(path.join(folder,'fictional.swtransfer')),key);
 const batch=await validateNativePacket(decoded.plaintext);
 if(batch.mode!=='simulated'||batch.observations.length!==14)throw Error();
 const namespace='context-sandbox-transfer-check-'+randomUUID();let vault=await openContextSandbox(namespace);
 try{
  const item=stageNativeTransfer(vault,batch,decoded.digest,decoded.key);
  decideNativeTransfer(vault,item.id,item.revision,'accept');closeVault(vault);
  vault=await openContextSandbox(namespace);
  if(previewNativeTransfer(vault,item.id).observations.length!==14)throw Error();
  writeFileSync(path.join(folder,'storywalker-receipt.json'),JSON.stringify(nativeReceipt(vault,item.id)),{mode:0o600});
  console.log('Swift ciphertext validated by Pydantic; 14 fictional observations survived encrypted Vault reopen. Authenticated receipt ready for Swift verification.');
 }finally{decoded.key.fill(0);decoded.plaintext.fill(0);closeVault(vault);rmSync(path.join(process.cwd(),'private-data',namespace),{recursive:true,force:true});}
}
main().catch(()=>{console.error('Fictional transfer verification failed; details withheld.');process.exitCode=1;});
