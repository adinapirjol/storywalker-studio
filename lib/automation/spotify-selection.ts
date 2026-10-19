import {constants,closeSync,fsyncSync,mkdirSync,openSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {MAX_SYNC_PLAYLISTS} from './contracts';

export const spotifySelectionSchema=z.object({
  version:z.literal(1),selectedAt:z.string().datetime({offset:true}),
  playlistIds:z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/)).max(MAX_SYNC_PLAYLISTS),
}).strict();

/** Selected lookup identities only. Never exports playlist labels or Vault keys. */
export function exportSpotifySelection(ids:string[],folder=resolve('private-data/spotify')) {
  const manifest=spotifySelectionSchema.parse({version:1,selectedAt:new Date().toISOString(),playlistIds:[...new Set(ids)]});
  mkdirSync(folder,{recursive:true,mode:0o700});
  if(realpathSync(folder)!==resolve(folder))throw Error('UNSAFE_SELECTION_PATH');
  const temporary=resolve(folder,`selection-${randomUUID()}.tmp`);
  const fd=openSync(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try {
    try{writeFileSync(fd,JSON.stringify(manifest));fsyncSync(fd);}finally{closeSync(fd);}
    renameSync(temporary,resolve(folder,'selected.private.json'));
  }catch(error){try{unlinkSync(temporary);}catch{/* Preserve the original failure. */}throw error;}
}
