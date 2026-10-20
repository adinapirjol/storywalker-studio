import * as fs from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class StageCommitUncertain extends Error {
  constructor() { super('STAGE_COMMIT_UNCERTAIN'); }
}
export function syncPrivateDirectory(directory:string){
  const fd=fs.openSync(directory,fs.constants.O_RDONLY);
  try {fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
export function writePrivateExclusive(file:string,bytes:string|Buffer){
  const fd=fs.openSync(file,'wx',0o600);
  try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
/** Locking, real-path validation and input selection belong to the collector. */
export function replacePrivateStage(directory:string,name:string,bytes:string,check:()=>void){
  const temporary=join(directory,`.update-${randomUUID()}.tmp`);let renamed=false;
  try {
    writePrivateExclusive(temporary,bytes);
    check();
    fs.renameSync(temporary,join(directory,name));renamed=true;
    syncPrivateDirectory(directory);
  }catch(error){
    if(renamed)throw new StageCommitUncertain();
    throw error;
  }finally{if(!renamed)fs.rmSync(temporary,{force:true});}
}
