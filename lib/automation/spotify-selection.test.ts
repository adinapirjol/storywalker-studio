import {expect,it} from 'vitest';
import {mkdtempSync,readFileSync,realpathSync,rmSync,statSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportSpotifySelection,spotifySelectionSchema} from './spotify-selection';

it('exports exactly selected lookup identities, supports removal and keeps owner-only permissions',()=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'spotify-selection-')));
  try {
    const folder=join(root,'spotify');
    const ids=Array.from({length:5},(_,i)=>`fictionalplaylist${i}`);
    exportSpotifySelection([...ids,ids[0]],folder);
    const target=join(folder,'selected.private.json');
    expect(spotifySelectionSchema.parse(JSON.parse(readFileSync(target,'utf8'))).playlistIds).toEqual(ids);
    expect(statSync(target).mode&0o777).toBe(0o600);
    exportSpotifySelection([ids[0]],folder);
    expect(JSON.parse(readFileSync(target,'utf8')).playlistIds).toEqual([ids[0]]);
    exportSpotifySelection([],folder);
    expect(JSON.parse(readFileSync(target,'utf8')).playlistIds).toEqual([]);
    symlinkSync(folder,join(root,'link'));
    expect(()=>exportSpotifySelection(ids,join(root,'link'))).toThrow('UNSAFE_SELECTION_PATH');
    expect(()=>exportSpotifySelection(['../foreign'],folder)).toThrow();
    expect(JSON.parse(readFileSync(target,'utf8')).playlistIds).toEqual([]);
  }finally{rmSync(root,{recursive:true,force:true});}
});
