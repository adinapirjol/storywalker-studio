import {expect,it} from 'vitest';
import {emptySettings,MAX_SYNC_PLAYLISTS,syncSettingsSchema} from './contracts';

it('saves five chosen playlists together with 28 Calendar choices',()=>{
  const settings={...emptySettings,
    spotifyIds:Array.from({length:5},(_,i)=>`fictionalplaylist${i}`),
    calendarKeys:Array.from({length:28},(_,i)=>i.toString(16).padStart(64,'0')),
  };
  expect(syncSettingsSchema.parse(settings)).toEqual(settings);
});

it('keeps automatic playlist imports bounded',()=>{
  const spotifyIds=Array.from({length:MAX_SYNC_PLAYLISTS+1},(_,i)=>`fictionalplaylist${i}`);
  expect(syncSettingsSchema.safeParse({...emptySettings,spotifyIds}).success).toBe(false);
});
