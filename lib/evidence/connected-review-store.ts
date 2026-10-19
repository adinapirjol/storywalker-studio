import { constants } from 'node:fs';
import { open, realpath, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { preparePrivateCandidateImport } from './private-candidate-import';
import { privateProposalSchema, type PrivateAuthorReviewDocument } from './private-author-review';
import { connectedRecordSchema, decisionKey, proposalActionSchema, reviewProposals, reviseProposal, type ConnectedRecord, type ReviewCard, type ReviewUpdate, type ConnectedReviewCatalog, type ConnectedReviewPage } from './connected-review';

type Guard = () => void;
const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const descriptorSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,100}$/), label: z.string().min(1).max(200), directory: z.string().max(300), files: z.record(z.string().regex(/^[a-f0-9]{64}$/)) }).strict();
const registrySchema = z.object({ version: z.literal(1), packages: z.array(descriptorSchema).max(8) }).strict();
const updatesSchema = z.object({ version: z.literal(1), packageId: z.string(), records: z.array(connectedRecordSchema).max(100).default([]), updates: z.array(z.object({ id: z.string(), receivedAt: z.string().datetime({ offset: true }), authorText: z.string().max(16000), targets: z.array(z.string()).max(100), effective: z.record(z.unknown()), source: z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),archive:z.string().max(300)}).optional(), excluded: z.boolean().optional() })).max(1000) });
const decisionsSchema = z.object({ version: z.literal(1), decisions: z.record(privateProposalSchema) }).strict();
const objectArray = z.array(z.record(z.unknown())).max(30000);
const PAGE_BYTES = 600_000;
export class ReviewConflict extends Error {}

function below(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(s => !s || s === '..' || s === '.')) throw new Error('Invalid registered path.');
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid registered path.');
  return result;
}
async function readPrivate(root: string, relative: string, guard: Guard, limit = 8_000_000) {
  guard();
  const file = below(root, relative);
  if (await realpath(file) !== file) throw new Error('Linked private input rejected.');
  guard();
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Private input exceeds limits.');
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) { guard(); const next = await handle.read(bytes, count, bytes.length - count, null); if (!next.bytesRead) break; count += next.bytesRead; }
    guard();
    if (count !== stat.size) throw new Error('Private input changed during read.');
    return bytes.subarray(0, count).toString('utf8');
  } finally { await handle.close(); }
}
async function optionalPrivate(root: string, relative: string, guard: Guard) {
  try { return await readPrivate(root, relative, guard, 2_000_000); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { guard(); return undefined; } throw error; }
}
async function readRegistry(root: string, guard: Guard) {
  const raw = await optionalPrivate(root, 'review/catalog.private.json', guard);
  return raw ? registrySchema.parse(JSON.parse(raw)) : { version: 1 as const, packages: [] };
}
async function readDecisions(root: string, guard: Guard) {
  const raw = await optionalPrivate(root, 'review/decisions.private.json', guard);
  const document = raw ? decisionsSchema.parse(JSON.parse(raw)) : { version: 1 as const, decisions: {} };
  return { document, revision: digest(JSON.stringify(document)) };
}
type Package = Awaited<ReturnType<typeof loadPackage>>;
async function loadPackage(root: string, id: string | undefined, guard: Guard) {
  const registry = await readRegistry(root, guard);
  const descriptor = id ? registry.packages.find(p => p.id === id) : registry.packages[0];
  if (!descriptor) throw new Error('Registered review unavailable.');
  const directory = below(root, descriptor.directory);
  let bytes = 0;
  async function text(file: string) {
    const expected = descriptor!.files[file];
    if (!expected) throw new Error('Unregistered review file.');
    const raw = await readPrivate(directory, file, guard);
    bytes += Buffer.byteLength(raw);
    if (bytes > 16_000_000 || digest(raw) !== expected) throw new Error('Review source changed; reconnect explicitly.');
    return raw;
  }
  const raw = await text('review-records.private.jsonl');
  const lines = raw.trim().split('\n');
  if (lines.length > 30000 || lines.some(l => Buffer.byteLength(l) > 750_000)) throw new Error('Review exceeds limits.');
  const records = lines.map(l => connectedRecordSchema.parse(JSON.parse(l)));
  if (new Set(records.map(r => r.id)).size !== records.length) throw new Error('Duplicate record identities.');
  const relationships = z.object({ confirmedReferences: objectArray, proposedConnections: objectArray, unresolved: objectArray }).parse(JSON.parse(await text('relationships.private.json')));
  const assets = z.object({ assets: objectArray }).parse(JSON.parse(await text('assets.private.json'))).assets;
  const prior = z.array(z.unknown()).max(10000).parse(JSON.parse(await text('preserved-decisions.private.json')));
  const sources = z.object({ sources: objectArray }).parse(JSON.parse(await text('source-index.private.json'))).sources;
  const bundleIndex = z.object({ bundles: z.array(z.object({ file: z.string(), sha256: z.string() })).max(32) }).parse(JSON.parse(await text('bundle-index.private.json')));
  const candidates = new Map<string, PrivateAuthorReviewDocument['candidates'][number]>();
  for (const bundle of bundleIndex.bundles) {
    if (descriptor.files[bundle.file] !== bundle.sha256) throw new Error('Bundle index changed.');
    const checked = preparePrivateCandidateImport(JSON.parse(await text(bundle.file)));
    const content = checked.records[0].payload as { bundle: { document: PrivateAuthorReviewDocument } };
    for (const candidate of content.bundle.document.candidates) {
      if (candidates.has(candidate.id)) throw new Error('Duplicate candidate identity.');
      candidates.set(candidate.id, candidate);
    }
  }
  const updateRaw = await optionalPrivate(root, 'review/author-updates.private.json', guard);
  const authorData = updateRaw ? updatesSchema.parse(JSON.parse(updateRaw)) : undefined;
  const updates = authorData?.packageId === descriptor.id ? authorData.updates : [];
  if (updates.some(u=>u.source && digest(u.authorText)!==u.source.sha256)) throw new Error('Author source hash changed.');
  if (authorData?.packageId === descriptor.id) {
    for (const record of authorData.records) { if (records.some(r=>r.id===record.id)) throw new Error('Duplicate Author record.'); records.push(record); }
  }
  const decisions = await readDecisions(root, guard);
  guard();
  return { registry, descriptor, records, relationships, assets, prior, sources, candidates, updates, ...decisions };
}
function updatesFor(data: Package, id: string): ReviewUpdate[] { return data.updates.filter(u => u.targets.includes(id)); }
function excluded(data: Package, id: string) { return updatesFor(data, id).some(u => u.excluded); }
function linked(record: ConnectedRecord, relation: Record<string, unknown>) { return relation.from === record.id || relation.to === record.id || (Array.isArray(relation.to) && relation.to.includes(record.id)); }
function card(data: Package, record: ConnectedRecord): ReviewCard {
  const source = data.sources.find(s => s.id === record.provenance.sourceId);
  // Raw archives and filesystem paths are deliberately not served by this review endpoint.
  const sourceDetails = source ? Object.fromEntries(['id','sha256','bytes','role','observedByAuditAt','filesystemModifiedAt','declaredTimes'].map(k => [k,source[k]])) : { id: record.provenance.sourceId, status: 'source metadata unavailable' };
  const allLinks = [...data.relationships.confirmedReferences, ...data.relationships.proposedConnections, ...data.relationships.unresolved];
  const content = record.content as { id?: string } | null;
  return {
    record, source: sourceDetails,
    proposals: reviewProposals(record, data.candidates).map(p => data.document.decisions[decisionKey(record,p.id)] ?? p),
    relationships: allLinks.filter(l => linked(record,l)),
    assets: data.assets.filter(a => a.proposedTarget === record.id || a.proposedObservation === record.id || a.sourceId === record.provenance.sourceId),
    priorDecisions: data.prior.filter(p => { if (!p || typeof p !== 'object') return false; const x = p as { candidate?: string; id?: string }; return x.candidate === record.id || (content?.id !== undefined && x.id === content.id); }),
    authorUpdates: updatesFor(data,record.id),
  };
}
export async function connectedReviewCatalog(root: string, packageId: string | undefined, guard: Guard): Promise<ConnectedReviewCatalog> {
  const registry = await readRegistry(root, guard);
  const packages = registry.packages.map(({id,label}) => ({id,label}));
  if (!packages.length) return { packages, selected: null, scopes: [], total: 0, fragments: 0, excluded: 0 };
  const data = await loadPackage(root, packageId, guard);
  const scopes = new Map<string,number>();
  for (const record of data.records) { if (record.kind === 'lossless-source-fragment' || excluded(data,record.id)) continue; scopes.set(record.scope,(scopes.get(record.scope)??0)+1); }
  guard();
  return { packages, selected: data.descriptor.id, scopes: [...scopes].map(([id,records])=>({id,records})), total: data.records.length, fragments: data.records.filter(r=>r.kind==='lossless-source-fragment').length, excluded: data.records.filter(r=>excluded(data,r.id)).length };
}
export async function connectedReviewPage(root: string, query: { packageId?: string; scope?: string; recordId?: string; search?: string; offset: number; fragments?: boolean; excluded?: boolean }, guard: Guard): Promise<ConnectedReviewPage> {
  const data = await loadPackage(root, query.packageId, guard);
  const search = query.search?.trim().toLocaleLowerCase();
  const filtered = data.records.filter(r => (query.fragments || r.kind !== 'lossless-source-fragment') && (query.excluded || !excluded(data,r.id)) && (!query.scope || r.scope === query.scope) && (!query.recordId || r.id === query.recordId) && (!search || JSON.stringify([r.title,r.content,r.id,updatesFor(data,r.id)]).toLocaleLowerCase().includes(search)));
  const records: ReviewCard[] = [];
  let bytes = 0;
  for (const record of filtered.slice(query.offset)) {
    const next = card(data,record); const size = Buffer.byteLength(JSON.stringify(next));
    if (size > 800_000) throw new Error('Record exceeds response limit.');
    if (records.length && (bytes+size>PAGE_BYTES || records.length>=12)) break;
    records.push(next); bytes+=size;
  }
  guard();
  return { packageId: data.descriptor.id, label: data.descriptor.label, records, total: filtered.length, offset: query.offset, next: query.offset+records.length<filtered.length?query.offset+records.length:null, revision: data.revision };
}
let writeQueue: Promise<void> = Promise.resolve();
async function persistDecisions(root: string, next: unknown, revision: string, guard: Guard) {
  guard();
  const directory = below(root,'review');
  await mkdir(directory,{recursive:true,mode:0o700});
  if (await realpath(directory)!==directory) throw new Error('Linked review folder rejected.');
  guard();
  const temp = path.join(directory,`.decisions-${randomUUID()}.tmp`);
  const handle = await open(temp,'wx',0o600);
  try { await handle.writeFile(JSON.stringify(next,null,2)+'\n','utf8'); await handle.sync(); } finally { await handle.close(); }
  try {
    const current = await readDecisions(root,guard);
    if (current.revision!==revision) throw new ReviewConflict('Review changed; reload before saving.');
    guard();
    await rename(temp,path.join(directory,'decisions.private.json'));
  } finally { await unlink(temp).catch(()=>undefined); }
}
export async function saveConnectedProposal(root: string, input: unknown, guard: Guard) {
  const task = async () => {
    guard();
    const action = proposalActionSchema.parse(input);
    const data = await loadPackage(root,action.packageId,guard);
    if (data.revision !== action.revision) throw new ReviewConflict('Review changed; reload before saving.');
    const record = data.records.find(r=>r.id===action.recordId);
    if (!record || excluded(data,record.id)) throw new Error('Active source record required.');
    const source = reviewProposals(record,data.candidates).find(p=>p.id===action.proposalId);
    if (!source || source.originalText.startsWith('Editor review prompt:')) throw new Error('An interpretation is required.');
    const key = decisionKey(record,source.id);
    const result = reviseProposal(source,data.document.decisions[key],action.decision,action.revisedText);
    if (result.changed) await persistDecisions(root,{...data.document,decisions:{...data.document.decisions,[key]:result.proposal}},data.revision,guard);
    guard();
    return { changed: result.changed, proposal: result.proposal, storage: 'local-private-review; not an encrypted Vault import', canonical: false };
  };
  const result = writeQueue.then(task,task); writeQueue=result.then(()=>undefined,()=>undefined);return result;
}
