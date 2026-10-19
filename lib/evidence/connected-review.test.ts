import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { connectedReviewCatalog, connectedReviewPage, saveConnectedProposal, ReviewConflict } from './connected-review-store';
import { reviseProposal } from './connected-review';

const roots: string[]=[];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proposal={id:'interpretation:aurora',label:'possible-interpretation' as const,originalText:'Fictional reading of a fictional window.',status:'pending' as const,audit:[]};
const guard=()=>{};
afterEach(async()=>{await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true})));});
async function fixture() {
  const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'connected-review-')));roots.push(root);
  const dir=path.join(root,'prepared');await mkdir(path.join(root,'review'));await mkdir(path.join(dir,'bundles'),{recursive:true});
  const sourceText='Fictional Author source.';const sourceHash=hash(sourceText);
  const record={id:'fictional:window',scope:'aurora',kind:'existing-candidate',title:'Fictional window',content:{authorText:sourceText,proposals:[proposal]},privacy:'private',canonical:false,provenance:{sourceId:'source:'+sourceHash,sourceSha256:sourceHash,pointer:'/fictional/0',archive:'originals/fictional.txt'}};
  const second={...record,id:'fictional:plan',scope:'separate-plan',content:{authorText:'Fictional future plan.'}};
  const candidate={id:record.id,privacy:'private',canonical:false,reviewStatus:'pending',details:[{field:'author_wording',value:sourceText,knowledge:'author-reported'}],proposals:[proposal]};
  const bundle={deltaId:'fictional-aurora',document:{schemaVersion:1,privacy:'private',reviewStatus:'pending',purpose:'Fictional fixture only.',candidates:[candidate]},manifest:{deltaId:'fictional-aurora',privacy:'private',canonical:false,source:{sha256:sourceHash}},sourceText};
  const data:Record<string,string>={
    'review-records.private.jsonl':[record,second].map(r=>JSON.stringify(r)).join('\n')+'\n',
    'relationships.private.json':JSON.stringify({confirmedReferences:[{from:record.id,to:'source:'+sourceHash,relation:'source',status:'confirmed-source-reference'}],proposedConnections:[{from:record.id,to:'unresolved:target',status:'pending'}],unresolved:[]}),
    'assets.private.json':JSON.stringify({assets:[{proposedTarget:record.id,availability:'missing',sha256:null}]}),
    'preserved-decisions.private.json':JSON.stringify([{candidate:record.id,sourceProposal:{...proposal,id:'old:interpretation',status:'refused'}}]),
    'source-index.private.json':JSON.stringify({sources:[{id:'source:'+sourceHash,sha256:sourceHash,originalPath:'/private/should-not-be-served',role:'fictional'}]}),
    'bundles/fictional.private.json':JSON.stringify(bundle),
  };
  data['bundle-index.private.json']=JSON.stringify({bundles:[{file:'bundles/fictional.private.json',sha256:hash(data['bundles/fictional.private.json'])}]});
  for(const [name,text] of Object.entries(data))await writeFile(path.join(dir,name),text,{mode:0o600});
  const registry={version:1,packages:[{id:'fictional',label:'Fictional Aurora review',directory:'prepared',files:Object.fromEntries(Object.entries(data).map(([name,text])=>[name,hash(text)]))}]};
  await writeFile(path.join(root,'review/catalog.private.json'),JSON.stringify(registry));
  return {root,dir,registry,record,second};
}
it('assembles statement, provenance, pending interpretation, source references, missing asset and prior refusal without accepting anything',async()=>{
  const {root}=await fixture();const result=await connectedReviewPage(root,{offset:0},guard);const card=result.records[0];
  expect(card.record.content).toMatchObject({authorText:'Fictional Author source.'});expect(card.proposals[0].status).toBe('pending');
  expect(card.relationships).toHaveLength(2);expect(card.assets[0]).toMatchObject({availability:'missing',sha256:null});expect(card.priorDecisions[0]).toMatchObject({sourceProposal:{status:'refused'}});
  expect(card.source).not.toHaveProperty('originalPath');expect(card.record.canonical).toBe(false);
});
it('excludes a declined plan from active scope/results while retaining its source history and a separate Author addition',async()=>{
  const {root,second,record}=await fixture();await writeFile(path.join(root,'review/author-updates.private.json'),JSON.stringify({version:1,packageId:'fictional',records:[{...record,id:'author:new-plan',scope:'future-plan',kind:'author-reported-booking'}],updates:[{id:'correction',receivedAt:'2026-10-19T14:00:00Z',authorText:'I did not attend.',targets:[second.id],effective:{attendance:'did not attend'},excluded:true}]}));
  const catalogue=await connectedReviewCatalog(root,undefined,guard);expect(catalogue.total).toBe(3);expect(catalogue.excluded).toBe(1);expect(catalogue.scopes.map(s=>s.id)).not.toContain('separate-plan');
  expect((await connectedReviewPage(root,{offset:0},guard)).records.map(r=>r.record.id)).not.toContain(second.id);
  const history=await connectedReviewPage(root,{offset:0,excluded:true,recordId:second.id},guard);expect(history.records[0].authorUpdates[0].effective.attendance).toBe('did not attend');
});
it('persists only explicit interpretation decisions, retains original text/history, and rejects stale writes',async()=>{
  const {root,dir}=await fixture();const original=await readFile(path.join(dir,'bundles/fictional.private.json'),'utf8');const page=await connectedReviewPage(root,{offset:0},guard);
  const input={packageId:'fictional',recordId:'fictional:window',proposalId:proposal.id,decision:'refuse',revision:page.revision};
  expect(await saveConnectedProposal(root,input,guard)).toMatchObject({changed:true,canonical:false});
  const after=await connectedReviewPage(root,{offset:0},guard);expect(after.records[0].proposals[0]).toMatchObject({status:'refused',originalText:proposal.originalText,audit:[{action:'refuse'}]});
  await expect(saveConnectedProposal(root,{...input,decision:'accept'},guard)).rejects.toBeInstanceOf(ReviewConflict);
  expect(await saveConnectedProposal(root,{...input,revision:after.revision},guard)).toMatchObject({changed:false});
  expect(await readFile(path.join(dir,'bundles/fictional.private.json'),'utf8')).toBe(original);
  const revised=await saveConnectedProposal(root,{...input,revision:after.revision,decision:'revise',revisedText:'My fictional correction.'},guard);
  expect(revised.proposal.audit.map(x=>x.action)).toEqual(['refuse','revise']);
});
it('finds an Author-corrected date without rewriting the original observation',async()=>{
  const {root,record}=await fixture();
  await writeFile(path.join(root,'review/author-updates.private.json'),JSON.stringify({version:1,packageId:'fictional',records:[],updates:[{id:'dated-author-correction',receivedAt:'2026-10-19T14:00:00Z',authorText:'I returned on the corrected date.',targets:[record.id],effective:{dateRange:'Fictional corrected date'},source:{sha256:hash('I returned on the corrected date.'),archive:'fictional-source'}}]}));
  const result=await connectedReviewPage(root,{offset:0,search:'Fictional corrected date'},guard);
  expect(result.records.map(c=>c.record.id)).toEqual([record.id]);
  expect(result.records[0].record.content).toMatchObject({authorText:'Fictional Author source.'});
  expect(result.records[0].proposals[0].status).toBe('pending');
});
it('does not reset an already accepted source decision or permit a blank revision',()=>{
  const accepted={...proposal,status:'accepted' as const,audit:[{action:'accept' as const,at:'2026-10-18T12:00:00Z'}]};
  expect(reviseProposal(accepted,undefined,'accept')).toEqual({proposal:accepted,changed:false});
  expect(()=>reviseProposal(accepted,undefined,'revise',' ')).toThrow('Author wording');
});
it('fails closed on changed package bytes, traversal registry entries and symlink sources',async()=>{
  const {root,dir,registry}=await fixture();await writeFile(path.join(dir,'assets.private.json'),'{}');await expect(connectedReviewPage(root,{offset:0},guard)).rejects.toThrow('changed');
  registry.packages[0].directory='../prepared';await writeFile(path.join(root,'review/catalog.private.json'),JSON.stringify(registry));await expect(connectedReviewPage(root,{offset:0},guard)).rejects.toThrow('path');
  registry.packages[0].directory='prepared';await writeFile(path.join(root,'review/catalog.private.json'),JSON.stringify(registry));
  const target=path.join(root,'other');await writeFile(target,'{}');await rm(path.join(dir,'assets.private.json'));await symlink(target,path.join(dir,'assets.private.json'));
  await expect(connectedReviewPage(root,{offset:0},guard)).rejects.toThrow('Linked');
});
it('does not release data or write a decision when authorization ends during source access',async()=>{
  const {root}=await fixture();let calls=0;const expired=()=>{if(++calls>5)throw new Error('Session ended');};
  await expect(connectedReviewPage(root,{offset:0},expired)).rejects.toThrow('Session ended');
  await expect(readFile(path.join(root,'review/decisions.private.json'))).rejects.toMatchObject({code:'ENOENT'});
});
it('returns bounded pages without merging independent source records',async()=>{
  const f=await fixture();const filename='review-records.private.jsonl';const many=Array.from({length:30},(_,i)=>({...f.record,id:'fictional:'+i,content:{text:'x'.repeat(60000)}}));const raw=many.map(r=>JSON.stringify(r)).join('\n')+'\n';await writeFile(path.join(f.dir,filename),raw);f.registry.packages[0].files[filename]=hash(raw);await writeFile(path.join(f.root,'review/catalog.private.json'),JSON.stringify(f.registry));
  const first=await connectedReviewPage(f.root,{offset:0},guard);expect(first.total).toBe(30);expect(first.next).toBeGreaterThan(0);expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(700000);
  const next=await connectedReviewPage(f.root,{offset:first.next!},guard);expect(next.records[0].record.id).not.toBe(first.records[0].record.id);
});

it('acknowledges a committed decision after access ends without releasing its private proposal',async()=>{
 const {root}=await fixture(), page=await connectedReviewPage(root,{offset:0},guard);
 const input={packageId:'fictional',recordId:'fictional:window',proposalId:proposal.id,decision:'refuse',revision:page.revision};
 const {existsSync}=await import('node:fs');
 const expiresAfterCommit=()=>{if(existsSync(path.join(root,'review/decisions.private.json')))throw Error('Session ended');};
 await expect(saveConnectedProposal(root,input,expiresAfterCommit)).rejects.toThrow('PRIVATE_WRITE_COMMITTED_RELOAD');
 const after=await connectedReviewPage(root,{offset:0},guard);expect(after.records[0].proposals[0].status).toBe('refused');
});
