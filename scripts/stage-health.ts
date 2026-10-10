/** Private staging only. No accounts, live capture, or passphrase sent to Python. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { createInterface as lines } from 'node:readline';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { closeVault, openVault, putVaultRecords, removeVaultRecords } from '../lib/vault/private-vault';
async function main() {
 const file=process.argv[2];if(!file)throw new Error('Provide a locally selected export.xml or export.zip path.');
 // Read through an existing unlocked session in the UI instead for production use.
 let muted=false;
 const output=new Writable({write(chunk,_encoding,done){if(!muted)process.stdout.write(chunk);done();}});
 const prompt=createInterface({input:process.stdin,output,terminal:true});
 process.stdout.write('Vault passphrase (hidden; stays in Node): ');muted=true;
 const passphrase=await prompt.question('');muted=false;prompt.close();process.stdout.write('\n');
 const vault=await openVault(passphrase);const id=`health:stage:${randomUUID()}`;const ids:string[]=[];let count=0;
 try {
  putVaultRecords(vault,[{id,kind:'reference',capturedAt:new Date().toISOString(),payload:{schemaVersion:1,source:'apple-health-stage',status:'staging',count:0,chunkIds:[],privacy:'private',canonical:false}}]);
  const child=spawn(resolve('research/rehearsal-dramaturg/.venv/bin/python'),['research/rehearsal-dramaturg/scripts/health_stream.py',resolve(file)],{env:{...process.env,PYTHONPATH:resolve('research/rehearsal-dramaturg')},stdio:['ignore','pipe','pipe']});
  child.stderr.resume();const exit=new Promise<number|null>(r=>child.on('close',r));
  for await(const line of lines({input:child.stdout})){
   const packet=JSON.parse(line);count+=packet.length;
   const chunk=`${id}:chunk:${ids.length}`;ids.push(chunk);
   putVaultRecords(vault,[{id:chunk,kind:'reference',capturedAt:new Date().toISOString(),payload:{schemaVersion:1,source:'apple-health-stage',status:'pending-review',privacy:'private',canonical:false,observations:packet}},{id,kind:'reference',capturedAt:new Date().toISOString(),payload:{schemaVersion:1,source:'apple-health-stage',status:'staging',count,chunkIds:[...ids],privacy:'private',canonical:false}}]);
  }
  if(await exit!==0)throw new Error('Import rejected. Staged chunks will be removed.');
  putVaultRecords(vault,[{id,kind:'reference',capturedAt:new Date().toISOString(),payload:{schemaVersion:1,source:'apple-health-stage',status:'pending-review',count,chunkIds:ids,privacy:'private',canonical:false}}]);
  console.log(`Staged ${count} historical observations for private review. Nothing accepted; no notifications.`);
 }catch(e){removeVaultRecords(vault,[id,...ids]);throw e;}finally{closeVault(vault);}
}
main().catch(()=>{console.error('Health staging failed; source details withheld.');process.exitCode=1;});
