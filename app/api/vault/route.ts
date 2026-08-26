import { z } from "zod";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { closeVault, importEditorCut, importGoogleMapsSharedList, importLastFmHistory, importPreparedGoogleMapsSelectedList, importPreparedGoogleTakeout, importPrivateEditorialDraft, importSelectedPrivateSource, initialiseVault, migrateRecoveryIntoVault, openVault, openVaultWithKey, putVaultRecords, readPublicDrafts, readScenarioStudio, rebuildVaultRetrievalIndex, refreshVaultDerivedViews, retrieveVaultEvidence, searchVault, vaultDriverReady, vaultExists, vaultImportMarkers, vaultSummary, type OpenVault, type VaultRecord } from "@/lib/private-vault";
import { prepareSideQuestVaultImport } from "@/lib/side-quest-import";
import { buildDirectorModelBrief, buildDirectorPreview } from "@/lib/nova-director";
import { lastFmEnvironmentSchema, readLastFmScrobbles } from "@/lib/lastfm-server";
import { privateEditorialCandidates, readPrivateEditorialCandidate } from "@/lib/private-editorial-candidates";
import { createVaultSession, deleteVaultSession, readVaultSession, VAULT_SESSION_COOKIE, vaultSessionCookie } from "@/lib/vault-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const captureSchema = z.object({
  title: z.string().trim().min(1).max(240),
  kind: z.enum(["event", "application", "playlist", "reference", "work-update", "travel", "idea"]),
  status: z.enum(["happened", "planned", "applied", "not-selected", "in-progress", "uncertain"]),
  when: z.string().trim().max(120),
  evidence: z.string().trim().max(2_000),
  threads: z.array(z.string().trim().min(1).max(100)).max(12),
});

const publicDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  format: z.enum(["note", "medium", "substack", "portfolio"]),
  body: z.string().trim().min(1).max(10_000),
  sourceRecordIds: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
});

const privateSourceImportSchema = z.object({
  source: z.enum(["spotify-history", "google-timeline", "echoes-export", "editor-cut"]),
  content: z.string().min(1).max(12_000_000),
  consent: z.literal(true),
});
const lastFmImportSchema = z.object({
  username: z.string().trim().min(1).max(64),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  consent: z.literal(true),
});
const googleMapsListImportSchema = z.object({
  url: z.string().url().max(2_000),
  content: z.string().min(1).max(4_000_000),
  consent: z.literal(true),
});
const privateEditorialDraftSchema = z.object({
  candidateId: z.string().regex(/^[a-f0-9]{24}$/u),
  consent: z.literal(true),
});
const fieldTraceSchema = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().max(100_000),
  note: z.string().trim().max(800),
  consent: z.literal(true),
});
const directorThreadSchema = z.object({
  title: z.string().trim().min(3).max(180),
  query: z.string().trim().min(3).max(200),
  sourceRecordIds: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
  localReadings: z.array(z.object({ title: z.string().trim().min(1).max(100), reading: z.string().trim().min(1).max(4_000), caveat: z.string().trim().min(1).max(1_000) })).min(1).max(4),
  tests: z.array(z.string().trim().min(1).max(1_000)).min(1).max(8),
  consent: z.literal(true),
});
const scenarioStudioSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storywalker-scenario-constellation"),
  privacy: z.literal("private"),
  canonical: z.literal(false),
  status: z.literal("author-draft"),
  title: z.string().trim().min(1).max(160),
  framing: z.string().trim().min(1).max(1_000),
  pathways: z.array(z.object({ id: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(180), timing: z.string().trim().min(1).max(300), currentCondition: z.string().trim().min(1).max(1_000), connectedPathwayIds: z.array(z.string().trim().min(1).max(100)).max(24) })).min(2).max(16),
  connections: z.array(z.object({ id: z.string().trim().min(1).max(100), pathwayIds: z.array(z.string().trim().min(1).max(100)).max(16), note: z.string().trim().min(1).max(1_000) })).max(32),
  atlasSourceRecordIds: z.array(z.string().trim().min(1).max(240)).max(96),
  atlasLaneSelections: z.record(z.string().trim().min(1).max(160), z.array(z.string().trim().min(1).max(240)).max(48)).optional(),
  boundary: z.string().trim().min(1).max(1_000),
});

const requestSchema = z.object({
  action: z.enum(["initialise", "unlock", "session-status", "lock-session", "migrate-recovery", "capture", "record-field-trace", "search", "build-evidence-pack", "rebuild-retrieval-index", "atlas-now", "scenario-studio", "save-scenario-studio", "director-preview", "director-model-proposal", "create-director-thread", "create-public-draft", "list-public-drafts", "list-private-editorial-candidates", "import-side-quest", "import-private-source", "import-private-editorial-draft", "import-lastfm-history", "import-google-maps-list", "import-prepared-google-maps-selected-list", "import-prepared-google-takeout", "probe"]),
  passphrase: z.string().min(12).max(512).optional(),
  capture: captureSchema.optional(),
  publicDraft: publicDraftSchema.optional(),
  sideQuest: z.unknown().optional(),
  privateSource: privateSourceImportSchema.optional(),
  lastFm: lastFmImportSchema.optional(),
  googleMapsList: googleMapsListImportSchema.optional(),
  editorialDraft: privateEditorialDraftSchema.optional(),
  fieldTrace: fieldTraceSchema.optional(),
  directorSelection: z.object({ sourceIds: z.array(z.string().min(1).max(240)).min(1).max(8), consent: z.literal(true) }).optional(),
  directorThread: directorThreadSchema.optional(),
  scenario: scenarioStudioSchema.optional(),
  query: z.string().trim().min(3).max(200).optional(),
});

function noStore(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

function sessionResponse(body: unknown, token: string, expiresAt: string) {
  const response = noStore(body);
  response.cookies.set(vaultSessionCookie(token, expiresAt));
  return response;
}

export async function GET() {
  const store = await cookies();
  const session = readVaultSession(store.get(VAULT_SESSION_COOKIE)?.value);
  return noStore({ exists: vaultExists(), imports: await vaultImportMarkers(), session: session ? { active: true, expiresAt: session.expiresAt } : { active: false } });
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const store = await cookies();
    const sessionToken = store.get(VAULT_SESSION_COOKIE)?.value;
    if (body.action === "probe") return Response.json({ driverReady: await vaultDriverReady() }, { headers: { "Cache-Control": "no-store" } });
    if (body.action === "session-status") {
      const session = readVaultSession(sessionToken);
      return noStore({ session: session ? { active: true, expiresAt: session.expiresAt } : { active: false } });
    }
    if (body.action === "lock-session") {
      deleteVaultSession(sessionToken);
      const response = noStore({ locked: true });
      response.cookies.set({ name: VAULT_SESSION_COOKIE, value: "", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }
    if (body.action === "initialise") {
      if (!body.passphrase) return noStore({ error: "Choose a Vault passphrase before creating the local Vault." }, 400);
      const created = await initialiseVault(body.passphrase);
      const vault = await openVault(body.passphrase);
      try {
        const session = createVaultSession(vault.key);
        return sessionResponse({ created, summary: vaultSummary(vault), session: { active: true, expiresAt: session.expiresAt } }, session.token, session.expiresAt);
      } finally { closeVault(vault); }
    }

    let vault: OpenVault;
    let newSession: { token: string; expiresAt: string } | undefined;
    if (body.passphrase) {
      vault = await openVault(body.passphrase);
      newSession = createVaultSession(vault.key);
    } else {
      const session = readVaultSession(sessionToken);
      if (!session) throw new Error("Unlock the Vault from /vault first. This local browser session expires exactly 15 minutes after unlock.");
      vault = await openVaultWithKey(session.key);
    }
    try {
      if (body.action === "unlock") {
        if (!newSession) {
          const session = readVaultSession(sessionToken);
          return noStore({ summary: vaultSummary(vault), session: { active: true, expiresAt: session?.expiresAt } });
        }
        return sessionResponse({ summary: vaultSummary(vault), session: { active: true, expiresAt: newSession.expiresAt } }, newSession.token, newSession.expiresAt);
      }
      if (body.action === "list-private-editorial-candidates") return Response.json({ editorialCandidates: privateEditorialCandidates() }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "migrate-recovery") return Response.json({ migration: migrateRecoveryIntoVault(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "search") return Response.json({ results: searchVault(vault, body.query ?? "") }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "build-evidence-pack") return Response.json({ evidencePack: retrieveVaultEvidence(vault, body.query ?? "") }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "rebuild-retrieval-index") return Response.json({ retrievalIndex: rebuildVaultRetrievalIndex(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "atlas-now") return Response.json({ atlas: refreshVaultDerivedViews(vault, true).atlas, summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "scenario-studio") return Response.json({ atlas: refreshVaultDerivedViews(vault).atlas, scenario: readScenarioStudio(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "save-scenario-studio") {
        if (!body.scenario) return Response.json({ error: "Add at least two possible routes before saving the private constellation." }, { status: 400 });
        const savedAt = new Date().toISOString();
        const scenario = { ...body.scenario, savedAt };
        const record: VaultRecord = { id: "scenario-studio:constellation:v1", kind: "scenario-studio", capturedAt: savedAt, payload: scenario };
        putVaultRecords(vault, [record]);
        return Response.json({ scenario, summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "director-preview") return Response.json({ director: buildDirectorPreview(retrieveVaultEvidence(vault, body.query ?? "")) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "director-model-proposal") {
        const selection = body.directorSelection;
        if (!selection) return Response.json({ error: "Choose up to eight sources and explicitly consent before any selected excerpt leaves this device." }, { status: 400 });
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return Response.json({ error: "No Director model is configured on this local machine. Your selected evidence has not left the Vault." }, { status: 400 });
        const preview = buildDirectorPreview(retrieveVaultEvidence(vault, body.query ?? ""));
        const brief = buildDirectorModelBrief(preview, selection.sourceIds);
        const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.NOVA_DIRECTOR_MODEL ?? "gpt-5", store: false, input: JSON.stringify(brief) }) });
        const result = await response.json() as { error?: { message?: string }; output_text?: string };
        if (!response.ok || !result.output_text) return Response.json({ error: result.error?.message ?? "The Director model did not return a proposal." }, { status: 502 });
        return Response.json({ proposal: { text: result.output_text, sourceIds: selection.sourceIds, externalModelCalled: true, canonical: false, saved: false } }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "create-director-thread") {
        const thread = body.directorThread;
        if (!thread) return Response.json({ error: "An explicitly accepted Director Thread is required." }, { status: 400 });
        const capturedAt = new Date().toISOString();
        const record: VaultRecord = { id: `thread:nova-director:${crypto.randomUUID()}`, kind: "thread", capturedAt, payload: { schemaVersion: 1, source: "nova-director-local-handoff", privacy: "private", canonical: false, reviewStatus: "pending", status: "author-accepted-working-thread", title: thread.title, query: thread.query, sourceRecordIds: thread.sourceRecordIds, localReadings: thread.localReadings, tests: thread.tests, acceptedAt: capturedAt, noEpisodeCreated: true, noPublicPromotion: true } };
        putVaultRecords(vault, [record]);
        return Response.json({ thread: { id: record.id, title: thread.title, capturedAt }, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "list-public-drafts") return Response.json({ drafts: readPublicDrafts(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "import-side-quest") {
        const prepared = prepareSideQuestVaultImport(body.sideQuest);
        putVaultRecords(vault, prepared.records);
        return Response.json({ import: prepared.summary, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "import-private-source") {
        const source = body.privateSource;
        if (!source) return Response.json({ error: "Choose a private source and explicitly consent to this local import." }, { status: 400 });
        if (source.source === "editor-cut") return Response.json({ editorCut: importEditorCut(vault, source.content), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
        let raw: unknown;
        try { raw = JSON.parse(source.content) as unknown; } catch { return Response.json({ error: "That source file was not valid JSON." }, { status: 400 }); }
        return Response.json({ import: importSelectedPrivateSource(vault, source.source, raw), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "import-private-editorial-draft") {
        if (!body.editorialDraft) return Response.json({ error: "Choose a private Markdown draft and explicitly consent to its local encryption." }, { status: 400 });
        const selected = readPrivateEditorialCandidate(body.editorialDraft.candidateId);
        return Response.json({ editorialDraft: importPrivateEditorialDraft(vault, selected.candidate.id, selected.markdown), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "import-lastfm-history") {
        const lastFm = body.lastFm;
        if (!lastFm) return Response.json({ error: "Choose a Last.fm window and explicitly consent to this one-time import." }, { status: 400 });
        const environment = lastFmEnvironmentSchema.safeParse(process.env);
        if (!environment.success) return Response.json({ error: "Last.fm is not configured on this local machine. Add LASTFM_API_KEY to your local .env.local, then restart Storywalker." }, { status: 400 });
        const raw = await readLastFmScrobbles(environment.data, lastFm);
        return Response.json({ import: { ...importLastFmHistory(vault, raw), pagination: raw.pagination }, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "import-google-maps-list") {
        if (!body.googleMapsList) return Response.json({ error: "Choose a shared Google Maps list and explicitly consent to its one-time import." }, { status: 400 });
        return Response.json({ import: importGoogleMapsSharedList(vault, body.googleMapsList.url, body.googleMapsList.content), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "import-prepared-google-maps-selected-list") return Response.json({ import: importPreparedGoogleMapsSelectedList(vault), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "import-prepared-google-takeout") return Response.json({ import: importPreparedGoogleTakeout(vault), derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      if (body.action === "record-field-trace") {
        const trace = body.fieldTrace;
        if (!trace) return Response.json({ error: "An explicitly consented Field Trace is required." }, { status: 400 });
        const capturedAt = new Date().toISOString();
        const record: VaultRecord = { id: `field-trace:${crypto.randomUUID()}`, kind: "capture", capturedAt, payload: { schemaVersion: 1, source: "live-field-trace", privacy: "private", sensitivity: "restricted", canonical: false, reviewStatus: "pending", consent: "explicit-save-after-live-fix", occurredAt: trace.occurredAt, preciseLocation: { latitude: trace.latitude, longitude: trace.longitude, accuracyMeters: trace.accuracyMeters }, note: trace.note || null, provenance: "browser-geolocation" } };
        putVaultRecords(vault, [record]);
        return Response.json({ captured: { id: record.id, capturedAt }, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      if (body.action === "create-public-draft") {
        const publicDraft = body.publicDraft;
        if (!publicDraft) return Response.json({ error: "A public draft is required." }, { status: 400 });
        const capturedAt = new Date().toISOString();
        const record: VaultRecord = { id: `public-draft:${crypto.randomUUID()}`, kind: "public-draft", capturedAt, payload: { ...publicDraft, privacy: "public-candidate", canonical: false, publicationStatus: "draft", promotion: "author-approved", capturedAt } };
        putVaultRecords(vault, [record]);
        return Response.json({ drafted: { id: record.id, capturedAt }, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
      }
      const capture = body.capture;
      if (!capture) return Response.json({ error: "A capture is required." }, { status: 400 });
      const capturedAt = new Date().toISOString();
      const record: VaultRecord = { id: `capture:${crypto.randomUUID()}`, kind: "capture", capturedAt, payload: { ...capture, privacy: "private", canonical: false, reviewStatus: "pending", evidenceStatus: "author-stated", capturedAt } };
      putVaultRecords(vault, [record]);
      return Response.json({ captured: { id: record.id, capturedAt }, derived: refreshVaultDerivedViews(vault), summary: vaultSummary(vault) }, { headers: { "Cache-Control": "no-store" } });
    } finally { closeVault(vault); }
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Local Vault request failed." }, { status: 400 }); }
}
