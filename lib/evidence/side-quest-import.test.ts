import { describe, expect, it } from "vitest";
import { prepareSideQuestVaultImport,verifySideQuestVaultImport } from "./side-quest-import";
import {randomUUID} from 'node:crypto';
import {readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {openContextSandbox,closeVault,putVaultRecords,readVaultRecord} from '@/lib/vault/private-vault';

const fixture = {
  schema: "side-quest-control-room", schemaVersion: 1, exportType: "private-export", exportedAt: "2026-08-26T12:00:00Z", source: { title: "Fictional control room", purpose: "Fictional test", persistence: "local" },
  counts: { jobs: 1, volunteering: 1, studyProgrammes: 1, scheduleEvents: 1, scheduleActions: 1, unresolvedDates: 1 },
  pipelines: { jobs: { records: [{ id: "job-1", company: "Fictional company" }] }, volunteering: { records: [{ id: "volunteer-1", name: "Fictional festival" }] }, creativeTechStudy: { programmes: [{ id: "study-1", programme: "Fictional programme" }], applicationPlan: [{ id: "plan-1", milestone: "Fictional plan" }], credentialGuide: {}, importReport: {} } },
  schedule: { events: [{ id: "event-1", title: "Fictional event" }], actions: [{ id: "action-1", title: "Fictional action" }], unresolved: [{ id: "unresolved-1", title: "Fictional unknown" }], customEvents: [] }, restoreState: {},
};

describe("Side Quest Control Room import", () => {
  it("preserves the source snapshot and creates stable, opaque encrypted-Vault records", () => {
    const first = prepareSideQuestVaultImport(fixture, "2026-08-26T13:00:00Z");
    const repeated = prepareSideQuestVaultImport(fixture, "2026-08-26T13:00:00Z");
    expect(first.records).toHaveLength(8);
    expect(first.records[0].payload).toMatchObject({ source: "side-quest-control-room", canonical: false, evidenceStatus: "source-recorded" });
    expect(first.records.map((record) => record.id)).toEqual(repeated.records.map((record) => record.id));
    expect(first.records.some((record) => record.id.includes("Fictional") || record.id.includes("job-1"))).toBe(false);
  });
  it('preserves newer export fields verbatim, includes professional records and detects changed source data',()=>{
    const newer={...fixture,counts:{...fixture.counts,professionalXp:1},pipelines:{...fixture.pipelines,
      professionalXp:{records:[{id:'experience-1',notes:'Fictional private experience'}]},
      creativeTechStudy:{...fixture.pipelines.creativeTechStudy,internationalMobility:{fictional:true},rankingPreferences:{example:5}},
    },schedule:{...fixture.schedule,actionAcknowledgements:{example:'reviewed'}}};
    const prepared=prepareSideQuestVaultImport(newer);
    expect((prepared.records[0].payload as {data:unknown}).data).toEqual(newer);
    expect(prepared.summary.professionalXp).toBe(1);
    expect(prepared.records.some(r=>(r.payload as {entityGroup?:string}).entityGroup==='professional-xp')).toBe(true);
    const stored=new Map(prepared.records.map(r=>[r.id,r]));
    expect(verifySideQuestVaultImport(prepared,id=>stored.get(id))).toBe(true);
    const snapshot=prepared.records[0];
    stored.set(snapshot.id,{...snapshot,payload:{...(snapshot.payload as object),data:fixture}});
    expect(verifySideQuestVaultImport(prepared,id=>stored.get(id))).toBe(false);
    stored.delete(snapshot.id);
    expect(verifySideQuestVaultImport(prepared,id=>stored.get(id))).toBe(false);
    expect(prepareSideQuestVaultImport({...newer,schedule:{...newer.schedule,actionAcknowledgements:{example:'changed'}}}).sourceHash).not.toBe(prepared.sourceHash);
  });
  it('accepts a structured export over 1 MB while preserving a bounded size',()=>{
    const input={...fixture,restoreState:{notes:'x'.repeat(1_100_000)}};
    expect((prepareSideQuestVaultImport(input).records[0].payload as {data:unknown}).data).toEqual(input);
    expect(()=>prepareSideQuestVaultImport({...fixture,restoreState:{notes:'x'.repeat(12_000_000)}})).toThrow('12 MB');
  });
  it('verifies the complete encrypted snapshot after closing and reopening storage',async()=>{
    const namespace=`context-sandbox-side-quest-${randomUUID()}`;
    let vault=await openContextSandbox(namespace);
    try{
      const input={...fixture,schedule:{...fixture.schedule,actionAcknowledgements:{example:'Fictional private acknowledgement'}}};
      const prepared=prepareSideQuestVaultImport(input);
      putVaultRecords(vault,prepared.records);
      expect(readFileSync(vault.storagePath!).includes(Buffer.from('Fictional private acknowledgement'))).toBe(false);
      closeVault(vault);vault=await openContextSandbox(namespace);
      expect(verifySideQuestVaultImport(prepared,id=>readVaultRecord(vault,id))).toBe(true);
      expect((readVaultRecord(vault,prepared.records[0].id)!.payload as {data:unknown}).data).toEqual(input);
    }finally{closeVault(vault);rmSync(join('private-data',namespace),{recursive:true,force:true});}
  });
  it('preserves distinct rows sharing a source ID and can recover a partial legacy import',()=>{
    const input={...fixture,pipelines:{...fixture.pipelines,volunteering:{records:[{id:'repeated',note:'Earlier fictional row'},{id:'repeated',note:'Later fictional row'}]}}};
    const prepared=prepareSideQuestVaultImport(input);
    const volunteers=prepared.records.filter(r=>(r.payload as {entityGroup?:string}).entityGroup==='volunteering');
    expect(volunteers).toHaveLength(2);
    expect(new Set(prepared.records.map(r=>r.id)).size).toBe(prepared.records.length);
    const partial=new Map(prepared.records.filter(r=>r.id!==volunteers[0].id).map(r=>[r.id,r]));
    expect(verifySideQuestVaultImport(prepared,id=>partial.get(id))).toBe(false);
    const additions=prepared.records.filter(r=>!partial.has(r.id));
    expect(additions).toEqual([volunteers[0]]);
    additions.forEach(r=>partial.set(r.id,r));
    expect(verifySideQuestVaultImport(prepared,id=>partial.get(id))).toBe(true);
    expect(prepareSideQuestVaultImport(input).records.map(r=>r.id)).toEqual(prepared.records.map(r=>r.id));
  });
});
