'use client';

import { useEffect, useRef, useState } from 'react';
import { vaultFetch } from '@/lib/vault/vault-access';
import type { ConnectedReviewCatalog, ConnectedReviewPage, ReviewCard, ReviewProposal } from '@/lib/evidence/connected-review';
import styles from './connected-private-review.module.css';

function label(text: string) { const spaced = text.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_:-]+/g,' '); return spaced.charAt(0).toUpperCase()+spaced.slice(1); }
function EvidenceValue({value}: {value: unknown}) {
  if (value === null || value === undefined) return <span>Not recorded</span>;
  if (typeof value === 'string') return <span className={styles.text}>{value}</span>;
  return <pre className={styles.json}>{JSON.stringify(value,null,2)}</pre>;
}
function Interpretation({proposal,onDecide,busy}: {proposal: ReviewProposal; onDecide: (id: string, action: 'accept'|'revise'|'refuse', text?: string)=>void; busy:boolean}) {
  const [text,setText] = useState(proposal.revisedText??'');
  const prompt = proposal.originalText.startsWith('Editor review prompt:');
  return <article className={styles.interpretation}>
    <p className="section-kicker">{prompt?'Review prompt':'Interpretation'} · {proposal.status}</p>
    <p>{prompt?'No new interpretation is proposed for this source. Meaning remains open.':proposal.revisedText??proposal.originalText}</p>
    {!prompt && <><label>Revision in your words<textarea value={text} onChange={e=>setText(e.target.value)} disabled={busy} maxLength={8000}/></label><div className="experiment-actions"><button type="button" disabled={busy} onClick={()=>onDecide(proposal.id,'accept')}>Accept interpretation</button><button type="button" disabled={busy||!text.trim()} onClick={()=>onDecide(proposal.id,'revise',text)}>Revise interpretation</button><button type="button" disabled={busy} onClick={()=>onDecide(proposal.id,'refuse')}>Refuse interpretation</button></div></>}
    {proposal.audit.length>0 && <details><summary>Decision history · {proposal.audit.length}</summary><EvidenceValue value={{originalInterpretation:proposal.originalText,audit:proposal.audit}}/></details>}
  </article>;
}
function RecordCard({card,busy,onDecide,onOpen}: {card: ReviewCard;busy:boolean;onDecide:(record:string,proposal:string,action:'accept'|'revise'|'refuse',text?:string)=>void;onOpen:(record:string)=>void}) {
  const r=card.record;
  const content = r.content && typeof r.content==='object' ? r.content as Record<string,unknown> : undefined;
  const update=card.authorUpdates.at(-1);
  const title=typeof update?.effective.title==='string'?update.effective.title:r.title??r.id;
  const authorText=content?.authorText??(r.kind==='conversation-statement'?content?.text:undefined);
  const details=Array.isArray(content?.details)?content.details as Array<{field:string;value:string;knowledge:string}>:undefined;
  return <article className={`notebook-card ${styles.record}`}>
    <p className="section-kicker">{label(r.scope)} · {label(r.kind)}</p><h3>{title}</h3>
    <p className="small-note">Private · non-canonical · {r.wordingClass??'source-recorded observation'}</p>
    {card.authorUpdates.map(u=><section className={styles.correction} key={u.id}><h4>{u.excluded?'Author exclusion':'Current Author correction'}</h4><blockquote>{u.authorText}</blockquote><EvidenceValue value={u.effective}/><small>Recorded {u.receivedAt}. Earlier source wording is retained below.</small><details><summary>Correction provenance</summary><EvidenceValue value={{id:u.id,receivedAt:u.receivedAt,source:u.source}}/></details></section>)}
    {authorText!==undefined && authorText!==null && <section><h4>{r.wordingClass==='author-message-with-quoted-third-party-notices'?'Your message, including quoted third-party notices':'Your statement'}</h4><blockquote><EvidenceValue value={authorText}/></blockquote><p className="small-note">{r.wordingClass==='author-message-with-quoted-third-party-notices'?'Quoted notices remain third-party material; they are not all Author statements.':'Exact accessible wording; the reporting date does not establish the event time.'}</p></section>}
    <details open={r.kind==='existing-candidate'||r.kind==='author-reported-booking'}><summary>{card.authorUpdates.length?'Earlier source evidence and dated disagreement':'Evidence, observations and uncertainty'}</summary>
      {details?<dl>{details.map((d,i)=><div key={i}><dt>{label(d.field)} · {d.knowledge}</dt><dd><EvidenceValue value={d.value}/></dd></div>)}</dl>:<dl>{content?Object.entries(content).filter(([k])=>!['authorText','text','proposals'].includes(k)).map(([k,v])=><div key={k}><dt>{label(k)}</dt><dd><EvidenceValue value={v}/></dd></div>):<EvidenceValue value={r.content}/>}</dl>}
    </details>
    <details><summary>Provenance and distinct times</summary><EvidenceValue value={{sourceId:r.provenance.sourceId,sourceSha256:r.provenance.sourceSha256,sourcePointer:r.provenance.pointer,sourceMetadata:card.source,eventTime:r.eventTime,observationTime:r.observationTime,sourceModifiedTime:r.sourceModifiedTime,exportTime:r.exportTime,auditObservedAt:r.auditObservedAt,vaultStatus:r.vaultStatus,existingEncryptedRecordId:r.existingEncryptedRecordId}}/></details>
    <section><h4>Interpretations</h4>{card.proposals.length?card.proposals.map(p=><Interpretation key={p.id+':'+p.audit.length} proposal={p} busy={busy} onDecide={(pid,a,t)=>onDecide(r.id,pid,a,t)}/>):<p className="small-note">No new interpretation is recorded. Existing source decisions remain below where available.</p>}</section>
    {card.relationships.length>0 && <details><summary>Connected references and proposed links · {card.relationships.length}</summary>{card.relationships.map((l,i)=><section key={i}><p><b>{label(String(l.relation??'source reference'))}</b> · {String(l.status??'unresolved')}</p><EvidenceValue value={l}/>{typeof l.to==='string' && !l.to.startsWith('source:') && <button type="button" disabled={busy} onClick={()=>onOpen(String(l.to))}>Look for this target in review</button>}</section>)}</details>}
    {card.assets.length>0 && <details><summary>Assets and verification · {card.assets.length}</summary><EvidenceValue value={card.assets}/><p className="small-note">Unverified references remain unassociated. Images and conversation screenshots are not fetched or published by this view.</p></details>}
    {card.priorDecisions.length>0 && <details><summary>Preserved existing decisions</summary><EvidenceValue value={card.priorDecisions}/></details>}
  </article>;
}

export function ConnectedPrivateReview({loadVersion}: {loadVersion:number}) {
  const [catalog,setCatalog]=useState<ConnectedReviewCatalog>();const [page,setPage]=useState<ConnectedReviewPage>();
  const [scope,setScope]=useState('');const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [fragments,setFragments]=useState(false);const [excluded,setExcluded]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('Load private review above to include the connected local evidence packages.');const [expiresAt,setExpiresAt]=useState<string>();
  const owner=useRef<AbortController|null>(null);
  useEffect(()=>()=>owner.current?.abort(),[]);
  useEffect(()=>{
    if(!expiresAt)return;
    const timer=setTimeout(()=>{owner.current?.abort();setPage(undefined);setCatalog(undefined);setMessage('The Vault session ended. Load private review again to continue.');},Math.max(0,Date.parse(expiresAt)-Date.now()));
    return ()=>clearTimeout(timer);
  },[expiresAt]);
  async function get<T>(params:URLSearchParams,controller:AbortController) {
    const response=await vaultFetch('/api/private-review?'+params,{cache:'no-store',signal:controller.signal});
    const data=await response.json();controller.signal.throwIfAborted();
    if(!response.ok){if(response.status===401){setPage(undefined);setCatalog(undefined);}throw new Error(data.error??'Private evidence could not be loaded.');}
    if(data.expiresAt)setExpiresAt(data.expiresAt);return data as T;
  }
  async function loadPage(packageId:string,selection:{scope?:string;search?:string;offset?:number;fragments?:boolean;excluded?:boolean;record?:string}={}) {
    owner.current?.abort();const controller=new AbortController();owner.current=controller;setBusy(true);
    const p=new URLSearchParams({view:'evidence',mode:'page',package:packageId,offset:String(selection.offset??0)});
    if(selection.scope)p.set('scope',selection.scope);if(selection.search)p.set('q',selection.search);if(selection.fragments)p.set('fragments','1');if(selection.excluded)p.set('excluded','1');if(selection.record)p.set('record',selection.record);
    try{const result=await get<ConnectedReviewPage>(p,controller);setPage(result);setMessage(result.total?`${result.total} matching source records. Review decisions are local; no interpretation or canon is accepted by loading.`:'No matching review record. The target remains unresolved; no connection was inferred.');}
    catch(e){if(!controller.signal.aborted)setMessage(e instanceof Error?e.message:'Private review unavailable.');}
    finally{if(owner.current===controller)setBusy(false);}
  }
  useEffect(()=>{
    if(!loadVersion)return;
    const controller=new AbortController();owner.current?.abort();owner.current=controller;
    const params=new URLSearchParams(window.location.search);const packageId=params.get('package')??'';const initialScope=params.get('scope')??'';
    const request=new URLSearchParams({view:'evidence'});if(packageId)request.set('package',packageId);
    setBusy(true);
    void get<ConnectedReviewCatalog>(request,controller).then(async result=>{
      setCatalog(result);setScope(initialScope);setSearch('');setQuery('');
      if(result.selected)await loadPage(result.selected,{scope:initialScope,record:params.get('record')??undefined});
      else setMessage('No local evidence package is connected yet. Existing recovery review remains available.');
    }).catch(e=>{if(!controller.signal.aborted)setMessage(e instanceof Error?e.message:'Connected review unavailable.');}).finally(()=>{if(owner.current===controller)setBusy(false);});
    return ()=>controller.abort();
    // Only the explicit parent load action begins private source access.
  },[loadVersion]);
  function reload(selection:{scope?:string;search?:string;offset?:number;fragments?:boolean;excluded?:boolean;record?:string}={}) {if(catalog?.selected)void loadPage(catalog.selected,{scope,search,fragments,excluded,...selection});}
  async function decide(recordId:string,proposalId:string,decision:'accept'|'revise'|'refuse',revisedText?:string) {
    if(!page)return;owner.current?.abort();const controller=new AbortController();owner.current=controller;setBusy(true);
    try{
      const response=await vaultFetch('/api/private-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review-bundle-proposal',packageId:page.packageId,recordId,proposalId,decision,revisedText,revision:page.revision}),signal:controller.signal});
      const result=await response.json();controller.signal.throwIfAborted();if(!response.ok)throw new Error(result.error??'Save not confirmed; reload before retrying.');
      setMessage(result.changed?'Your interpretation decision was saved locally. Source evidence and canon are unchanged.':'That decision is already saved.');
      await loadPage(page.packageId,{scope,search,fragments,excluded,offset:page.offset});
    }catch(e){if(!controller.signal.aborted)setMessage(e instanceof Error?e.message:'Save not confirmed; reload before retrying.');}
    finally{if(owner.current===controller)setBusy(false);}
  }
  return <section id="connected-review" className={styles.review} aria-label="Connected private evidence">
    <div className="notebook-card"><p className="section-kicker">Connected private review</p><h2>Your statements, evidence and interpretations together</h2><p>Each experience keeps its source boundaries. Calendar plans, listening observations and subjective meaning remain distinct.</p><p className="live-notice" role="status">{message}</p>
      {catalog?.selected && <><p className="small-note">{catalog.total} source records · {catalog.fragments} storage fragments · {catalog.excluded} Author-excluded record. These packages remain local staging; loading does not import them into the encrypted Vault.</p><div className={styles.filters}>
        <label>Experience<select value={scope} disabled={busy} onChange={e=>{setScope(e.target.value);reload({scope:e.target.value,offset:0});}}><option value="">All separate experiences</option>{catalog.scopes.map(s=><option key={s.id} value={s.id}>{label(s.id)} · {s.records}</option>)}</select></label>
        <label>Find a statement or source<input value={query} maxLength={200} disabled={busy} onChange={e=>setQuery(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>{setSearch(query);reload({search:query,offset:0});}}>Search evidence</button>
        <label><input type="checkbox" checked={excluded} disabled={busy} onChange={e=>{setExcluded(e.target.checked);reload({excluded:e.target.checked,offset:0});}}/>Show Author-excluded source history</label>
        <label><input type="checkbox" checked={fragments} disabled={busy} onChange={e=>{setFragments(e.target.checked);reload({fragments:e.target.checked,offset:0});}}/>Show storage fragments</label>
        <button type="button" disabled={busy} onClick={()=>reload({offset:0})}>Refresh current selection</button>
      </div></>}
    </div>
    {page && <><p className="small-note">Showing {page.total?page.offset+1:0}–{page.offset+page.records.length} of {page.total}. Large analyses stay together and source fragments remain available separately.</p>{page.records.map(card=><RecordCard key={card.record.id} card={card} busy={busy} onDecide={(r,p,a,t)=>void decide(r,p,a,t)} onOpen={record=>reload({record,scope:'',search:'',offset:0})}/>)}<div className="experiment-actions"><button type="button" disabled={busy||page.offset===0} onClick={()=>reload({offset:0})}>Back to first results</button><button type="button" disabled={busy||page.next===null} onClick={()=>reload({offset:page.next??0})}>Next evidence records</button></div></>}
  </section>;
}
