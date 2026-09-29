'use client';
import {useState} from 'react';
import type {XRScene} from '@/lib/xr-scene';
export function XREvidenceReport({scene,onChange}:{scene:XRScene;onChange:(scene:XRScene)=>void}){
 const [windowId,setWindowId]=useState('');const report=scene.evidenceArchive;if(!report)return null;
 const selected=windowId||scene.journeyEpisodes?.[0]?.id;
 const matches=report.matches.filter(m=>m.windowId===selected);
 function decide(artifactId:string,decision:'accept'|'refuse'|'reconsider'){onChange({...scene,evidenceArchive:{...report!,decisions:[...report!.decisions,{artifactId,windowId:selected!,decision,author:'Author',at:new Date().toISOString()}]}});}
 return <details><summary>Vault enrichment report · {report.artifacts.length} candidate artefacts · {report.matches.filter(m=>m.status==='attached').length} strong links · {report.matches.filter(m=>m.status==='candidate').length} review links</summary>
 <p>{report.windowCount} source windows examined · {report.scannedRecords} Vault source records scanned · {report.unmatchedArtefacts} records/rows had no supported overlap. {report.skippedRecords} unsupported or separately represented records skipped. Scanned {report.scannedAt}.</p>
 <p>Ambiguous evidence is not attached automatically. Accepting records your contextual association; it does not confirm attendance, an event or its meaning. Save review to Vault to preserve decisions.</p>
 <label>Review source window<select value={selected} onChange={e=>setWindowId(e.target.value)}>{scene.journeyEpisodes?.map(e=><option key={e.id} value={e.id}>{e.id} · {e.start} · {e.label}</option>)}</select></label>
 {matches.length===0&&<p>No additional supported artefacts for this window.</p>}
 {matches.map(m=>{const a=report.artifacts.find(a=>a.id===m.artifactId)!,d=[...report.decisions].reverse().find(d=>d.artifactId===a.id&&d.windowId===m.windowId);return <article key={a.id}><h4>{a.kind} · {a.title}</h4><p>{m.basis} · {m.explanation}</p><p>{d?`Author decision: ${d.decision}`:m.status==='attached'?'Automatically attached by strong provenance':'Candidate only — not inside the evidence surface'}</p><p>{a.preview.join(' · ')}</p><details><summary>Exact source</summary><p>{a.sourceId} · {a.fingerprint}</p></details><button onClick={()=>decide(a.id,'accept')}>Accept association</button> <button onClick={()=>decide(a.id,'refuse')}>Refuse</button> <button onClick={()=>decide(a.id,'reconsider')}>Reconsider</button></article>;})}
 <ul>{report.notes.map(n=><li key={n}>{n}</li>)}</ul>
 </details>;
}
