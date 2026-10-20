import { afterEach, expect, it, vi } from 'vitest';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { openContextSandbox, closeVault, putVaultRecords, readVaultRecord, searchVault, retrieveVaultEvidence, type OpenVault, type VaultRecord } from './private-vault';
import { configureResearch, readResearchJournal } from '@/lib/health/server/research-journal';
import { receiveTransfer, configureReceiver, type ReceiverConfig } from '@/lib/native/native-receiver';
import * as transfer from '@/lib/native/native-transfer';
import type { Observation, ValidatedTransfer } from '@/lib/native/native-transfer-contract';
import { buildEvidencePack } from '@/lib/evidence/private-signal-engine';
import { buildLocalRetrievalIndex } from './private-retrieval-index';
import { createVaultSession, deleteVaultSession } from './vault-session';
const opened: { vault: OpenVault; name: string }[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const f of opened.splice(0)) { closeVault(f.vault); rmSync(join('private-data', f.name), { recursive: true, force: true }); } });
async function sandbox() { const name = 'context-sandbox-pr6-' + randomUUID(); const vault = await openContextSandbox(name); opened.push({ vault, name }); return vault; }
function sleep(): Observation { return { schema_version: 1, id: 'fictional-sleep', source_id: 'fictional-watch', source_type: 'healthkit', source_revision: '1', device_revision: 'fictional-device', event_start: '2026-02-01T00:00:00+02:00', event_end: '2026-02-01T08:00:00+02:00', received_at: '2026-03-01T12:00:00Z', original_offset: '+02:00', semantics: 'interval', acquisition: 'historical', provenance: 'source_recorded', quality: ['recorded_on_apple_watch'], payload: { kind: 'sleep', stage: 'core' } }; }
function stage(vault: OpenVault) { const batch: ValidatedTransfer = { version: 1, batch_id: randomUUID(), mode: 'healthkit', observations: [sleep()], deletions: [] }; return transfer.stageNativeTransfer(vault, batch, 'a'.repeat(64), randomBytes(32), 'fictional-pair'); }
it('requires explicit receiver acceptance even when HEALTH research is connected', async () => {
 const vault = await sandbox(); configureResearch(vault, 'connect');
 const batch: ValidatedTransfer = { version: 1, batch_id: randomUUID(), mode: 'healthkit', observations: [sleep()], deletions: [] };
 vi.spyOn(transfer, 'validateNativePacket').mockResolvedValue(batch);
 const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from('storywalker-transfer-v1'));
 const envelope = Buffer.concat([iv, cipher.update('fictional packet'), cipher.final(), cipher.getAuthTag()]).toString('base64');
 expect(await receiveTransfer(vault, { mode: 'healthkit', id: 'fictional-pair' } as ReceiverConfig, { action: 'deliver', envelope, key: key.toString('base64') })).toEqual({ status: 'pending-review' });
 expect(readResearchJournal(vault)?.source).toBeNull();
});
it('deletes accepted sleep with more than 10200 unrelated tombstones', async () => {
 const vault = await sandbox(); configureResearch(vault, 'connect', 'all'); const pending = stage(vault);
 const accepted = transfer.decideNativeTransfer(vault, pending.id, pending.revision, 'accept');
 putVaultRecords(vault, Array.from({ length: 10201 }, (_, i) => ({ id: 'native:evidence:fictional-heart-tombstone-' + i, kind: 'reference', capturedAt: '2026-03-01T00:00:00Z', payload: { deleted: true } })));
 expect(transfer.decideNativeTransfer(vault, accepted.id, accepted.revision, 'delete').status).toBe('deleted');
 const id = 'native:evidence:' + createHash('sha256').update('healthkit\n' + sleep().id).digest('hex');
 expect(readVaultRecord(vault, id)?.payload).toEqual({ deleted: true });
}, 20000);
it('keeps backups and administrative records out of every retrieval entry point', async () => {
 const vault = await sandbox();
 const hidden: VaultRecord[] = ['automation:backup:fixture', 'automation:settings:v1', 'automation:receipt:v1', 'lastfm:before-window-import:fixture', 'xr:spatial-draft:before-fixture', 'native:study04:journal', 'health:stage:fixture'].map(id => ({ id, kind: 'reference', capturedAt: '2026-03-01T00:00:00Z', payload: { text: 'fictionalcanary' } }));
 putVaultRecords(vault, hidden);
 expect(searchVault(vault, 'fictionalcanary')).toEqual([]);
 expect(retrieveVaultEvidence(vault, 'fictionalcanary').evidence).toEqual([]);
 expect(buildEvidencePack(hidden, 'fictionalcanary').evidence).toEqual([]);
 expect(buildLocalRetrievalIndex(hidden).records).toEqual([]);
 const source: VaultRecord = { id: 'reference:ordinary', kind: 'reference', capturedAt: '2026-03-01T00:00:00Z', payload: { text: 'fictionalcanary' } };
 putVaultRecords(vault, [source]); expect(searchVault(vault, 'fictionalcanary').map(r => r.id)).toEqual([source.id]);
});
it('revocation removes credentials from address-repair copies too', async () => {
 const vault = await sandbox(), session = createVaultSession(vault.key);
 try {
  const payload = { version: 1, id: 'fictional-pair', token: 'fictional-secret', privateKey: 'fictional-key', certificate: 'fictional-cert', revoked: false };
  putVaultRecords(vault, ['native:pairing:receiver', 'native:pairing:before-address:fixture'].map(id => ({ id, kind: 'reference', capturedAt: '2026-03-01T00:00:00Z', payload })));
  await configureReceiver(vault, session.token, 'revoke');
  expect(readVaultRecord(vault, 'native:pairing:receiver')?.payload).toEqual({ revoked: true });
  expect(readVaultRecord(vault, 'native:pairing:before-address:fixture')).toBeUndefined();
 } finally { deleteVaultSession(session.token); }
});

it('commits deletion and invalidates calculations when live sleep exceeds the analysis limit', async () => {
 const vault = await sandbox(); configureResearch(vault, 'connect', 'all');
 const selected = stage(vault); const accepted = transfer.decideNativeTransfer(vault, selected.id, selected.revision, 'accept');
 configureResearch(vault, 'set-hypothesis', undefined, 'Fictional authored context to preserve.');
 putVaultRecords(vault, Array.from({ length: 10201 }, (_, i) => ({ id: 'native:evidence:fictional-sleep-' + i, kind: 'reference', capturedAt: sleep().received_at, payload: { observation: { ...sleep(), id: 'fictional-sleep-' + i } } })));
 expect(transfer.decideNativeTransfer(vault, accepted.id, accepted.revision, 'delete').status).toBe('deleted');
 expect(readResearchJournal(vault)).toMatchObject({ history: [], refreshRequired: true, hypothesis: { text: 'Fictional authored context to preserve.' } });
}, 20000);

it('keeps unowned legacy stages pending instead of granting a new pairing ownership',async()=>{
 const vault=await sandbox();const batch:ValidatedTransfer={version:1,batch_id:randomUUID(),mode:'healthkit',observations:[sleep()],deletions:[]};
 const legacy=transfer.stageNativeTransfer(vault,batch,'b'.repeat(64),randomBytes(32));
 expect(transfer.canAutomaticallyAcceptHealthStage(vault,legacy.id,'fictional-new-pairing')).toBe(false);
 expect(transfer.decideNativeTransfer(vault,legacy.id,legacy.revision,'accept').status).toBe('accepted-evidence');
});
