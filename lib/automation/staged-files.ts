import { constants, openSync, closeSync, fstatSync, readSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Fixed local paths only; reject symlinks, public permissions and oversized files. */
export function readPrivateStage(relative: string, maxBytes=16_000_000, root=resolve('private-data')): unknown {
  const base=realpathSync(root), target=resolve(base,relative);
  if(!target.startsWith(base+sep)||realpathSync(target)!==target) throw Error('UNSAFE_STAGE');
  const fd=openSync(target,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>maxBytes) throw Error('UNSAFE_STAGE');
    const data=Buffer.alloc(stat.size+1);
    try {
      let size=0, count=0;
      do {count=readSync(fd,data,size,data.length-size,null);size+=count;} while(count>0&&size<data.length);
      if(size!==stat.size) throw Error('STAGE_CHANGED');
      return JSON.parse(data.subarray(0,size).toString('utf8'));
    } finally {data.fill(0);}
  } finally {closeSync(fd);}
}
