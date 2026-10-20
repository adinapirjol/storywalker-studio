import { createHash } from "node:crypto";
import { z } from "zod";
import type { VaultRecord } from "@/lib/vault/private-vault";
import { MAX_SELECTED_TEXT_BYTES } from '@/lib/files/selected-file-reader';

const entitySchema = z.object({ id: z.string().min(1).max(240) }).passthrough();
const recordGroupSchema = z.object({ records: z.array(entitySchema) });
const scheduleEntitySchema = z.object({ id: z.string().min(1).max(240) }).passthrough();

export const sideQuestControlRoomSchema = z.object({
  schema: z.string().min(1), schemaVersion: z.number().int().positive(), exportType: z.string().min(1), exportedAt: z.string().min(1),
  source: z.object({ title: z.string().min(1), purpose: z.string().min(1), persistence: z.string().min(1) }),
  counts: z.object({ jobs: z.number().int().nonnegative(), volunteering: z.number().int().nonnegative(), studyProgrammes: z.number().int().nonnegative(), scheduleEvents: z.number().int().nonnegative(), scheduleActions: z.number().int().nonnegative(), unresolvedDates: z.number().int().nonnegative() }),
  pipelines: z.object({
    jobs: recordGroupSchema,
    volunteering: recordGroupSchema,
    professionalXp: recordGroupSchema.optional(),
    creativeTechStudy: z.object({ programmes: z.array(entitySchema), applicationPlan: z.array(entitySchema), credentialGuide: z.unknown(), importReport: z.unknown() }),
  }),
  schedule: z.object({ events: z.array(scheduleEntitySchema), actions: z.array(scheduleEntitySchema), unresolved: z.array(scheduleEntitySchema), customEvents: z.array(scheduleEntitySchema) }),
  restoreState: z.record(z.unknown()),
}).strict();

export type SideQuestControlRoom = z.infer<typeof sideQuestControlRoomSchema>;

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function privateEntityId(sourceHash: string, group: string, id: string, occurrence?:number) { return `side-quest:${group}:${hash({ sourceHash, id,...(occurrence===undefined?{}:{occurrence}) }).slice(0, 24)}`; }

/**
 * Converts a user-exported Side Quest Control Room snapshot into encrypted-Vault
 * records. The source is preserved verbatim as private data; this function never
 * executes instructions or turns trackers into autobiographical facts.
 */
export function prepareSideQuestVaultImport(input: unknown, importedAt = new Date().toISOString()) {
  if(Buffer.byteLength(JSON.stringify(input)??'')>MAX_SELECTED_TEXT_BYTES)throw new Error('Keep the Control Room export within 12 MB.');
  const source = sideQuestControlRoomSchema.parse(input);
  const sourceHash = hash(input);
  const snapshot: VaultRecord = {
    id: `side-quest:snapshot:${sourceHash.slice(0, 24)}`,
    kind: "import",
    capturedAt: importedAt,
    payload: {
      source: "side-quest-control-room", privacy: "private", canonical: false, evidenceStatus: "source-recorded", importStatus: "preserved", sourceHash, exportedAt: source.exportedAt, importedAt,
      data: input,
    },
  };
  const groups: Array<[string, Array<z.infer<typeof entitySchema>>]> = [
    ["job", source.pipelines.jobs.records], ["volunteering", source.pipelines.volunteering.records], ["professional-xp", source.pipelines.professionalXp?.records??[]], ["study-programme", source.pipelines.creativeTechStudy.programmes], ["study-plan", source.pipelines.creativeTechStudy.applicationPlan], ["schedule-event", source.schedule.events], ["schedule-action", source.schedule.actions], ["schedule-unresolved", source.schedule.unresolved], ["schedule-custom", source.schedule.customEvents],
  ];
  const entities = groups.flatMap(([group, records]) => {
    // The original importer retained the last row for a repeated source ID.
    // Keep that identity stable so a partial import can recover without erasure;
    // give every earlier occurrence its own opaque, deterministic identity.
    const lastPositions=new Map(records.map((record,index)=>[record.id,index]));
    return records.map((record,index) => ({
      id: privateEntityId(sourceHash, group, record.id,lastPositions.get(record.id)===index?undefined:index), kind: "import" as const, capturedAt: importedAt,
      payload: { source: "side-quest-control-room", sourceHash, entityGroup: group, sourceEntityIdHash: hash(record.id), privacy: "private", canonical: false, evidenceStatus: "source-recorded", importedAt, record },
    }));
  });
  return { records: [snapshot, ...entities], sourceHash, summary: { snapshots: 1, entities: entities.length, jobs: source.pipelines.jobs.records.length, volunteering: source.pipelines.volunteering.records.length, professionalXp: source.pipelines.professionalXp?.records.length??0, studyProgrammes: source.pipelines.creativeTechStudy.programmes.length, schedule: source.schedule.events.length + source.schedule.actions.length + source.schedule.unresolved.length + source.schedule.customEvents.length } };
}

/** Verify stored source contents without promoting any tracker claim to fact. */
export function verifySideQuestVaultImport(prepared:ReturnType<typeof prepareSideQuestVaultImport>,read:(id:string)=>VaultRecord|undefined){
  return prepared.records.every(expected=>{
    const payload=read(expected.id)?.payload as Record<string,unknown>|undefined;
    if(!payload||payload.sourceHash!==prepared.sourceHash||payload.privacy!=='private'||payload.canonical!==false)return false;
    const wanted=expected.payload as Record<string,unknown>;
    if(wanted.data!==undefined)return payload.data!==undefined&&hash(payload.data)===prepared.sourceHash;
    return payload.record!==undefined&&payload.entityGroup===wanted.entityGroup&&hash(payload.record)===hash(wanted.record);
  });
}
