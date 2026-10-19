import { z } from 'zod';
import { privateProposalSchema, type PrivateAuthorReviewDocument, type PrivateProposalAction } from './private-author-review';

export const connectedRecordSchema = z.object({
  id: z.string().min(1).max(300), scope: z.string().min(1).max(160), kind: z.string().max(100),
  title: z.string().max(1000).optional(), content: z.unknown(), privacy: z.literal('private'), canonical: z.literal(false),
  wordingClass: z.string().optional(), provenance: z.object({ sourceId: z.string(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), pointer: z.string(), archive: z.string() }),
}).passthrough();
export type ConnectedRecord = z.infer<typeof connectedRecordSchema>;
export type ReviewProposal = z.infer<typeof privateProposalSchema>;
export type ReviewUpdate = { id: string; receivedAt: string; authorText: string; targets: string[]; effective: Record<string, unknown>; source?: { sha256: string; archive: string }; excluded?: boolean };
export type ReviewCard = { record: ConnectedRecord; proposals: ReviewProposal[]; relationships: Record<string, unknown>[]; assets: Record<string, unknown>[]; priorDecisions: unknown[]; authorUpdates: ReviewUpdate[]; source: Record<string, unknown> };
export type ConnectedReviewCatalog = { packages: Array<{ id: string; label: string }>; selected: string | null; scopes: Array<{ id: string; records: number }>; total: number; fragments: number; excluded: number; expiresAt?: string };
export type ConnectedReviewPage = { packageId: string; label: string; records: ReviewCard[]; total: number; next: number | null; offset: number; revision: string; expiresAt?: string };
export const proposalActionSchema = z.object({
  packageId: z.string().regex(/^[a-z0-9-]{1,100}$/), recordId: z.string().min(1).max(300), proposalId: z.string().min(1).max(400),
  decision: z.enum(['accept', 'revise', 'refuse']), revisedText: z.string().min(1).max(8000).optional(), revision: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export function decisionKey(record: ConnectedRecord, proposalId: string) { return `${record.provenance.sourceSha256}:${record.id}:${proposalId}`; }
export function reviewProposals(record: ConnectedRecord, candidates: Map<string, PrivateAuthorReviewDocument['candidates'][number]>) {
  const content = record.content as { proposals?: unknown } | null;
  const supplied = candidates.get(record.id)?.proposals ?? (content && Array.isArray(content.proposals) ? content.proposals : []);
  return z.array(privateProposalSchema).parse(supplied);
}
export function reviseProposal(source: ReviewProposal, saved: ReviewProposal | undefined, action: PrivateProposalAction, text?: string, at = new Date().toISOString()) {
  const current = saved ?? source;
  if (current.originalText !== source.originalText || current.id !== source.id) throw new Error('Source changed.');
  const revisedText = text?.trim();
  if (action === 'revise' && !revisedText) throw new Error('A revision needs Author wording.');
  const status = action === 'accept' ? 'accepted' : action === 'revise' ? 'revised' : 'refused';
  if (current.status === status && (action !== 'revise' || current.revisedText === revisedText)) return { proposal: current, changed: false };
  return { proposal: privateProposalSchema.parse({ ...current, status, ...(action === 'revise' ? { revisedText } : {}), audit: [...current.audit, { action, at, ...(action === 'revise' ? { revisedText } : {}) }] }), changed: true };
}
