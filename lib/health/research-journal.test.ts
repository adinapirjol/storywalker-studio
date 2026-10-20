import { afterEach, expect, it } from "vitest";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openContextSandbox, closeVault, readVaultRecords, putVaultRecords, type OpenVault } from "@/lib/vault/private-vault";
import { configureResearch, researchView, readResearchJournal, journalID } from "./server/research-journal";
import { receiveTransfer, type ReceiverConfig } from "@/lib/native/native-receiver";
import type { Observation } from "@/lib/native/native-transfer-contract";
const opened: { vault: OpenVault; directory: string }[] = [];
afterEach(() => { for (const v of opened.splice(0)) { closeVault(v.vault); rmSync(v.directory, { recursive: true, force: true }); } });
async function sandbox() {
  const name = "context-sandbox-health-journal-" + randomUUID();
  const vault = await openContextSandbox(name), directory = join(process.cwd(), "private-data", name);
  opened.push({ vault, directory }); return { vault, directory, name };
}
function sleep(day = 1, source = "invented-watch"): Observation {
  return { schema_version: 1, id: "invented-sleep-" + day + source, source_id: source, source_type: "healthkit", source_revision: "1", device_revision: "invented-device", event_start: `2026-02-${String(day).padStart(2,"0")}T00:00:00+02:00`, event_end: `2026-02-${String(day).padStart(2,"0")}T08:00:00+02:00`, received_at: "2026-03-01T12:00:00Z", original_offset: "+02:00", semantics: "interval", acquisition: "historical", provenance: "source_recorded", quality: ["recorded_on_apple_watch"], payload: { kind: "sleep", stage: "core" } };
}
function envelope(rows: Observation[], deletions: string[] = []) {
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("storywalker-transfer-v1"));
  const plain = Buffer.from(JSON.stringify({ version: 1, batch_id: randomUUID(), mode: "healthkit", deliveries: [
    ...rows.map(o => ({ id: o.id, deletion: false, packet: Buffer.from(JSON.stringify(o)).toString("base64") })),
    ...deletions.map(id => ({ id: "delete:" + id, deletion: true, packet: Buffer.from(id).toString("base64") })),
  ] }));
  return { action: "deliver", envelope: Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]).toString("base64"), key: key.toString("base64") };
}
const config = { mode: "healthkit" } as ReceiverConfig;
it("persists encrypted notes across reopen, excludes general retrieval, and makes repeated saves idempotent", async () => {
  const f = await sandbox();
  const first = configureResearch(f.vault, "example").journal!;
  expect(first.history).toHaveLength(1);
  expect(configureResearch(f.vault, "refresh").journal).toEqual(first);
  expect(configureResearch(f.vault, "example").journal).toEqual(first);
  expect(readVaultRecords(f.vault)).toEqual([]);
  expect(readFileSync(join(f.directory, "scenario.sqlite")).includes(Buffer.from(first.history[0].notes[0].evidence))).toBe(false);
  closeVault(f.vault); const reopened = await openContextSandbox(f.name); opened[0].vault = reopened;
  expect(readResearchJournal(reopened)).toEqual(first);
  expect(configureResearch(reopened, "delete-notes").journal).toMatchObject({ connected: false, history: [] });
});
it("accepts explicitly opted-in Watch sleep and saves one new analysis per changed input", async () => {
  const { vault } = await sandbox();
  configureResearch(vault, "connect");
  const paired = { ...config, id: "explicit-watch-test", autoAcceptHealth: true };
  expect((await receiveTransfer(vault, paired, envelope([sleep()]))).status).toBe("accepted-evidence");
  const first = researchView(vault);
  expect(first.records).toHaveLength(1); expect(first.journal?.source).toBe(JSON.stringify(["invented-watch", "invented-device"]));
  expect(first.records[0].startRaw).toContain("+02:00");
  await receiveTransfer(vault, paired, envelope([sleep()]));
  expect(readResearchJournal(vault)?.history).toEqual(first.journal?.history);
  await receiveTransfer(vault, paired, envelope([sleep(2)]));
  expect(readResearchJournal(vault)?.history.length).toBe(first.journal!.history.length + 1);
  const oldIDs = readResearchJournal(vault)!.history.map(r => r.id);
  await receiveTransfer(vault, paired, envelope([], [sleep().id]));
  expect(researchView(vault).records).toHaveLength(1);
  expect(readResearchJournal(vault)?.history.some(r => oldIDs.includes(r.id))).toBe(false);
  configureResearch(vault,"disconnect");
  expect((await receiveTransfer(vault,{...paired,autoAcceptHealth:false},envelope([sleep(3)]))).status).toBe("pending-review");
}, 20000);
it("omits unknown timezone rather than substituting the current location", async () => {
  const { vault } = await sandbox(); configureResearch(vault,"connect");
  await receiveTransfer(vault,{...config,id:"timezone-test",autoAcceptHealth:true},envelope([{ ...sleep(), original_offset:"unknown" }]));
  const view = researchView(vault);
  expect(view.omitted).toBe(1); expect(view.records).toEqual([]);
  expect(view.journal?.history.at(-1)?.notes.some(n=>n.id === "coverage")).toBe(true);
}, 10000);
it("fails closed for malformed encrypted journal payload", async () => {
  const { vault } = await sandbox();
  putVaultRecords(vault,[{ id:journalID,kind:"reference",capturedAt:"1970-01-01T00:00:00Z",payload:{version:1,history:[]} }]);
  expect(()=>readResearchJournal(vault)).toThrow("RESEARCH_STATE_INVALID");
});
it("bounds history and never creates private mood or energy from sleep", async () => {
  const { vault } = await sandbox(); configureResearch(vault,"connect");
  for (let i=0; i<33; i++) {
    const o = { ...sleep(1), id: "invented-retention-" + i };
    // Direct accepted evidence here isolates retention from packet/transport tests above.
    putVaultRecords(vault,[{id:"native:evidence:retention-"+i,kind:"reference",capturedAt:o.received_at,payload:{observation:o}}]);
    if (i===0) configureResearch(vault,"connect",JSON.stringify([o.source_id,o.device_revision]));
    else configureResearch(vault,"refresh");
  }
  const journal=readResearchJournal(vault)!;
  expect(journal.history).toHaveLength(30);expect(journal.dropped).toBe(4);
  expect(journal.history.flatMap(r=>r.notes).some(n=>n.id.startsWith("association-"))).toBe(false);
});
it("accepts mixed sleep and heart batches only with explicit broad consent, including an already-staged receipt", async () => {
  const { vault } = await sandbox();
  const withoutID=sleep();
  const heart:Observation={...withoutID,id:"invented-heart",quality:[],semantics:"measurement",payload:{kind:"heart_rate",value:64,unit:"bpm"}};
  const mixed=[{...sleep(),quality:[]},heart];
  const paired={...config,id:"invented-pairing",autoAcceptHealth:false};
  const pending=await receiveTransfer(vault,paired,envelope(mixed));
  expect(pending.status).toBe("pending-review");
  const {listNativeTransfers}=await import("@/lib/native/native-transfer");
  const batch=listNativeTransfers(vault)[0];
  expect((await receiveTransfer(vault,{...paired,autoAcceptHealth:true,id:"other-pairing"},{action:"receipt",id:batch.id})).status).toBe("pending-review");
  const accepted=await receiveTransfer(vault,{...paired,autoAcceptHealth:true},{action:"receipt",id:batch.id});
  expect(accepted.status).toBe("accepted-evidence");expect(accepted).toHaveProperty("receipt");
  expect(await receiveTransfer(vault,{...paired,autoAcceptHealth:true},{action:"receipt",id:batch.id})).toEqual(accepted);
  expect(readVaultRecords(vault)).toEqual([]);
  expect((await receiveTransfer(vault,{...paired,autoAcceptHealth:true},envelope([sleep(2,"second-source")]))).status).toBe("accepted-evidence");
  const unknownDeletion=await receiveTransfer(vault,{...paired,autoAcceptHealth:true},envelope([], ["unknown-deletion"]));
  expect(unknownDeletion.status).toBe("pending-review");
  expect((await receiveTransfer(vault,{...paired,autoAcceptHealth:true},envelope([], [heart.id]))).status).toBe("accepted-evidence");
  expect((await receiveTransfer(vault,paired,envelope([sleep(3)]))).status).toBe("pending-review");
},20000);

it("combines sources durably, preserves previous analyses, and updates on new accepted sources", async () => {
  const f = await sandbox();
  const paired = { ...config, id: "combined-test", autoAcceptHealth: true } as ReceiverConfig;
  configureResearch(f.vault, "connect");
  await receiveTransfer(f.vault, paired, envelope([sleep()]));
  const old = readResearchJournal(f.vault)!;
  const combined = configureResearch(f.vault, "connect", "all");
  expect(combined.journal!.history[0].id).toBe(old.history[0].id);
  expect(combined.journal!.history.at(-1)).toMatchObject({ source: "all", algorithm: "observatory-v4" });
  // Analysis selection and receiver acceptance have independent consent.
  await receiveTransfer(f.vault, paired, envelope([sleep(2,"second"), sleep(3,"third")]));
  const saved = researchView(f.vault);
  expect(saved.records).toHaveLength(3);
  expect(saved.sources).toHaveLength(3);
  expect(saved.journal!.history.at(-1)!.recordCount).toBe(3);
  expect(saved.journal!.history.at(-1)!.notes.map(n => n.id)).toContain("duration-coverage");
  expect(saved.journal!.history.at(-1)!.notes.map(n => n.id)).toContain("period-comparison");
  expect(configureResearch(f.vault, "refresh").journal).toEqual(saved.journal);
  closeVault(f.vault); const reopened = await openContextSandbox(f.name); opened[0].vault = reopened;
  expect(researchView(reopened)).toEqual(saved);
  await receiveTransfer(reopened, paired, envelope([], [sleep(2,"second").id]));
  expect(researchView(reopened).records).toHaveLength(2);
  expect(readResearchJournal(reopened)!.history).toHaveLength(1);
}, 20000);

it("keeps a personal hypothesis separate from measurements across updates and reopen", async () => {
  const f = await sandbox();
  const paired = { ...config, id: "hypothesis-test", autoAcceptHealth: true } as ReceiverConfig;
  configureResearch(f.vault, "connect", "all");
  await receiveTransfer(f.vault, paired, envelope([sleep()]));
  const before = researchView(f.vault);
  const text = "Fictional hypothesis: recording gaps may coincide with a device charging routine.";
  const saved = configureResearch(f.vault, "set-hypothesis", undefined, text);
  expect(saved.records).toEqual(before.records);
  expect(saved.journal!.history).toEqual(before.journal!.history);
  expect(saved.journal!.hypothesis).toMatchObject({text, from:before.range.from, to:before.range.to});
  expect(readFileSync(join(f.directory,"scenario.sqlite")).includes(Buffer.from(text))).toBe(false);
  await receiveTransfer(f.vault,paired,envelope([sleep(2)]));
  expect(researchView(f.vault).journal!.hypothesis).toEqual(saved.journal!.hypothesis);
  closeVault(f.vault); const reopened = await openContextSandbox(f.name); opened[0].vault = reopened;
  expect(readResearchJournal(reopened)!.hypothesis).toEqual(saved.journal!.hypothesis);
  expect(configureResearch(reopened,"delete-notes").journal!.hypothesis).toBeUndefined();
},20000);

it("keeps cycle self-report optional, encrypted, date-bounded and separate from calculations", async () => {
  const f = await sandbox();
  configureResearch(f.vault, "connect", "all");
  const o = sleep();
  putVaultRecords(f.vault, [{ id: "native:evidence:cycle-fixture", kind: "reference", capturedAt: o.received_at, payload: { observation: o } }]);
  const before = configureResearch(f.vault, "refresh");
  const context = { date: "2026-02-01", day: 9, expectedLength: 31, included: false };
  const excluded = configureResearch(f.vault, "set-cycle-context", undefined, undefined, context);
  expect(excluded.journal!.history).toEqual(before.journal!.history);
  expect(excluded.records).toEqual(before.records);
  const included = configureResearch(f.vault, "set-cycle-context", undefined, undefined, { ...context, included: true });
  const run = included.journal!.history.at(-1)!;
  expect(run.notes.filter(n => n.id !== "cycle-context")).toEqual(before.journal!.history.at(-1)!.notes);
  expect(run.notes.find(n => n.id === "cycle-context")?.evidence).toContain("reported cycle day 9");
  expect(included.records).toEqual(before.records);
  expect(configureResearch(f.vault, "refresh").journal).toEqual(included.journal);
  expect(readVaultRecords(f.vault)).toEqual([]);
  expect(readFileSync(join(f.directory, "scenario.sqlite")).includes(Buffer.from('"expectedLength":31'))).toBe(false);
  closeVault(f.vault); const reopened = await openContextSandbox(f.name); opened[0].vault = reopened;
  expect(readResearchJournal(reopened)?.cycleContext).toEqual({ ...context, included: true });
  const off = configureResearch(reopened, "set-cycle-context", undefined, undefined, context).journal!;
  expect(off.history.at(-1)!.notes.some(n => n.id === "cycle-context")).toBe(false);
  expect(off.history.find(r => r.id === run.id)).toEqual(run);
  const outside = configureResearch(reopened, "set-cycle-context", undefined, undefined, { ...context, date: "2026-02-02", included: true });
  expect(outside.journal!.history.at(-1)!.notes.some(n => n.id === "cycle-context")).toBe(false);
  expect(() => configureResearch(reopened, "set-cycle-context", undefined, undefined, { ...context, day: 1.5 })).toThrow();
  expect(configureResearch(reopened, "set-cycle-context", undefined, undefined, null).journal!.cycleContext).toBeUndefined();
  configureResearch(reopened, "example");
  expect(() => configureResearch(reopened, "set-cycle-context", undefined, undefined, context)).toThrow();
});
