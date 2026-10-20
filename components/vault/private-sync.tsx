'use client';
import {useEffect,useState} from 'react';
import {vaultFetch} from '@/lib/vault/vault-access';
import {emptySettings,MAX_SYNC_PLAYLISTS,suggestCalendarEvent,syncSettingsSchema,type CalendarEvent,type SyncSettings} from '@/lib/automation/contracts';

type SyncResult={source:string;status:string;count?:number;added?:number;changed?:number;missing?:number};
function describeResults(results:SyncResult[]){
  return results.map(r=>`${r.source}: ${r.status}${r.count!==undefined?`, ${r.count} retained`:''}${r.added!==undefined?`, ${r.added} added`:''}${r.changed!==undefined?`, ${r.changed} updated`:''}${r.missing?`, ${r.missing} unavailable`:''}`).join('. ');
}

/** Only a completed browser unlock starts the receiver. Polling imports local stages. */
export function PrivateSyncMonitor(){
  useEffect(()=>{
    const abort=new AbortController();let busy=false,runRequested=false;
    async function poll(){
      if(busy||document.hidden||abort.signal.aborted)return;
      busy=true;
      const action=runRequested?'run':'poll';runRequested=false;
      try{
        const response=await fetch('/api/private-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),signal:abort.signal,cache:'no-store',credentials:'same-origin'});
        if(response.status===401)window.dispatchEvent(new Event('storywalker-vault-locked'));
      }catch{/* Never replay a possibly completed mutation; inspect the sync panel. */}
      finally{busy=false;if(runRequested&&!abort.signal.aborted)void poll();}
    }
    const unlocked=()=>{runRequested=true;void poll();};
    const timer=setInterval(()=>void poll(),60_000);
    document.addEventListener('visibilitychange',poll);
    window.addEventListener('storywalker-vault-unlocked',unlocked);
    return()=>{abort.abort();clearInterval(timer);document.removeEventListener('visibilitychange',poll);window.removeEventListener('storywalker-vault-unlocked',unlocked);};
  },[]);
  return null;
}

export function PrivateSyncPanel(){
  const [settings,setSettings]=useState<SyncSettings>(emptySettings);
  const [choices,setChoices]=useState<{id:string;name:string}[]>([]);
  const [events,setEvents]=useState<CalendarEvent[]>([]);
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('Unlock and load your saved choices.');
  const [filter,setFilter]=useState('all');
  useEffect(()=>{const clear=()=>{setLoaded(false);setEvents([]);setChoices([]);setSettings(emptySettings);setMessage('Vault locked. Unlock to reload your private choices.');};window.addEventListener('storywalker-vault-locked',clear);return()=>window.removeEventListener('storywalker-vault-locked',clear);},[]);
  async function call(body:unknown){
    const r=await vaultFetch('/api/private-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    const result=await r.json();
    if(!r.ok){
      const messages:Record<string,string>={
        INVALID_SYNC_CHOICES:`Choices could not be saved. Select up to ${MAX_SYNC_PLAYLISTS} playlists. Your selections are still here.`,
        SELECTION_UNAVAILABLE:'A selected source is no longer available. Your selections are still here; review them before saving again.',
      };
      throw Error(messages[result.code]??'Sync could not finish. Your selections are still here. Try again before reloading.');
    }
    return result;
  }
  async function load(){setBusy(true);try{
    const data=await call({action:'status'});setSettings(data.settings);setChoices(data.choices);setEvents(data.catalog?.events??[]);setLoaded(true);
    const latest=data.receipt?` Latest encrypted update (${data.receipt.at}): ${describeResults(data.receipt.results??[])}.`:'';
    setMessage(`${data.catalog?.events.length??0} Calendar candidates available. Nothing is selected automatically.${latest}`);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function save(){setBusy(true);try{
    if(!syncSettingsSchema.safeParse(settings).success)throw Error(`Choices could not be saved. Select up to ${MAX_SYNC_PLAYLISTS} playlists. Your selections are still here.`);
    const result=await call({action:'save',settings});setMessage(result.warning??'Choices saved privately. Use Run saved choices to check delivery now.');
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function run(){setBusy(true);try{
    const data=await call({action:'run'});
    setMessage(data.status==='saved-reload-required'?'Evidence was saved. Unlock and reload to confirm its current state.':`Watch: ${data.watch}. ${describeResults(data.results??[])} ${data.warning??''}`);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  function choose(key:string,enabled:boolean){setSettings(s=>({...s,calendarKeys:enabled?[...new Set([...s.calendarKeys,key])]:s.calendarKeys.filter(k=>k!==key)}));}
  const shown=events.filter(e=>filter==='all'||suggestCalendarEvent(e).startsWith(filter));
  return <main style={{maxWidth:960,margin:'3rem auto',padding:'1rem'}}>
    <a href="/vault">← Vault</a><h1>Private automatic updates</h1>
    <p>Chosen sources enter the encrypted Vault after unlock. Locking ends access; no passphrase is saved. Calendar entries describe plans, never confirmed attendance.</p>
    <button disabled={busy} onClick={()=>void load()}>Unlock / load sync choices</button>
    {loaded&&<>
      <h2>Watch & music</h2>
      <p><label><input type="checkbox" checked={settings.watch} onChange={e=>setSettings({...settings,watch:e.target.checked})}/> Resume the saved Watch pairing after unlock</label></p>
      <p>Uses the existing pairing and acceptance settings. A changed network address needs attention; no pairing is replaced. Stop receiver pauses this session; turn this choice off to stop future automatic resumption.</p>
      <p><label><input type="checkbox" checked={settings.lastfm} onChange={e=>setSettings({...settings,lastfm:e.target.checked})}/> Import staged Last.fm history automatically</label></p>
      {choices.map(c=><p key={c.id}><label><input type="checkbox" checked={settings.spotifyIds.includes(c.id)} onChange={e=>setSettings({...settings,spotifyIds:e.target.checked?[...settings.spotifyIds,c.id]:settings.spotifyIds.filter(id=>id!==c.id)})}/> Import staged playlist: {c.name}</label></p>)}
      <p>Selected playlists are refreshed by the daily collector and imported from local staging while the Vault is unlocked. Saving exports only their lookup identifiers to a private local file for collection. Existing listening history and previous playlist versions are retained.</p>
      <button disabled={busy} onClick={()=>void save()}>Save private sync choices</button>{' '}
      <button disabled={busy} onClick={()=>void run()}>Run saved choices now</button>
      <p role="status">{busy?'Working…':message}</p>
      <h2>Calendar · suggested historical selection</h2>
      <p>Suggestions use words in event titles. Recurring, cancelled and declined plans are flagged for review. No health, attendance or personality conclusions are drawn. Select individual rows or review a suggested group before adding it.</p>
      <label>Show <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All candidates</option><option value="Suggested:">Suggested travel, learning & culture</option><option value="Review">Needs individual review</option><option value="Excluded:">Cancelled or declined</option></select></label>
      <p>{shown.length} shown · {settings.calendarKeys.length} selected</p>
      {filter==='Suggested:'&&<button disabled={busy} onClick={()=>setSettings(s=>({...s,calendarKeys:[...new Set([...s.calendarKeys,...shown.map(e=>e.key)])]}))}>Select this reviewed suggestion group</button>}
      <div style={{maxHeight:500,overflow:'auto'}}>{shown.map(event=><p key={event.key}><label><input type="checkbox" checked={settings.calendarKeys.includes(event.key)} onChange={e=>choose(event.key,e.target.checked)}/> {event.start} — {event.title||'Untitled plan'}</label><br/><small>{suggestCalendarEvent(event)} · {event.status} · attendance unknown</small></p>)}</div>
      <p>Only selected event identities may be refreshed. Removing a selection stops future updates; earlier saved evidence remains private. Saving also writes selected Calendar event identifiers to an owner-only local file for the daily collector. Event details remain private; the collector can refresh only these selected identities.</p>
      <button disabled={busy} onClick={()=>void save()}>Save private sync choices</button>{' '}
      <button disabled={busy} onClick={()=>void run()}>Run saved choices now</button>
    </>}
    <p role="status">{busy?'Working…':message}</p>
  </main>;
}
