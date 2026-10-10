/** Fictional-only Swift → pinned HTTPS → Pydantic → encrypted sandbox → receipt rehearsal. */
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {makeReceiverConfig,pairingDocument,startReceiver,stopReceiver} from '../lib/native/native-receiver';
import {openContextSandbox,closeVault} from '../lib/vault/private-vault';
import {listNativeTransfers,decideNativeTransfer} from '../lib/native/native-transfer';
import {nativeTransaction} from '../lib/native/native-transaction';
let phase="setup";
async function main(){
 const namespace='context-sandbox-network-'+randomUUID(),folder=await mkdtemp(path.join(tmpdir(),'storywalker-network-fixture-'));
 const binary=path.resolve('research/body-context-native/.build/debug/collector-dry-run');
 const c=await makeReceiverConfig('127.0.0.1','simulated',0);
 const server=await startReceiver(c,'test',()=>openContextSandbox(namespace),()=>true);c.port=(server.address() as {port:number}).port;
 let connections=0;server.on('secureConnection',()=>connections++);
 const run=(flag:string)=>promisify(execFile)(binary,[flag,folder],{timeout:30000,maxBuffer:8192});
 try{
  await writeFile(path.join(folder,'pairing.json'),JSON.stringify(pairingDocument(c)),{mode:0o600});
  phase='Swift fixture';await run('--transfer-fixture');
  phase='Swift TLS staging';const staged=await run('--stream-network-fixture');if(connections!==1)throw Error('CONNECTION_NOT_REUSED');if(!staged.stdout.includes('queue retained'))throw Error('STAGE_FAILED');
  phase='retry';await run('--network-fixture'); // duplicate request must not create another batch
  await nativeTransaction(async()=>{const vault=await openContextSandbox(namespace);try{const items=listNativeTransfers(vault);if(items.length!==1||items[0].count!==14)throw Error('BAD_COUNT');decideNativeTransfer(vault,items[0].id,items[0].revision,'accept');}finally{closeVault(vault);}});
  // Incorrect certificate pins are rejected by the actual Swift client before any acknowledgement.
  const original=await readFile(path.join(folder,'pairing.json'),'utf8');
  await writeFile(path.join(folder,'pairing.json'),JSON.stringify({...JSON.parse(original),certificate_sha256:'0'.repeat(64)}),{mode:0o600});
  let rejected=false;try{await run('--network-fixture');}catch{rejected=true;}if(!rejected)throw Error('PIN_NOT_ENFORCED');
  await writeFile(path.join(folder,'pairing.json'),original,{mode:0o600});
  phase='receipt';const acknowledged=await run('--network-fixture');if(!acknowledged.stdout.includes('queue empty'))throw Error('ACK_FAILED');
  console.log('PASS: fictional Swift HTTPS delivery, Pydantic validation, 14 unique observations, duplicate retry, certificate pin rejection, encrypted Vault review, verified automatic receipt, reused Swift TLS connection, receipt-only check and empty phone queue.');
 }finally{await stopReceiver();await rm(folder,{recursive:true,force:true});await rm(path.join('private-data',namespace),{recursive:true,force:true});}
}
main().catch((error)=>{const code=typeof error?.stderr==='string'?error.stderr.match(/NETWORK_-?[0-9]+|REHEARSAL_FAILED/g)?.join(' '):undefined;console.error('NETWORK_REHEARSAL_FAILED: '+phase+' '+(code??''));process.exitCode=1;});
