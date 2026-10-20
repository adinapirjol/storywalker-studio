import { z } from "zod";
import { syntheticImport } from "../fixture";
import type { Diary } from "../model";
import type { SyntheticArchive, SyntheticObservation } from "../synthetic-archive";

/** Fixed invented source values. Neither a synthetic flag nor arbitrary client text is trusted. */
function fixtureValues(): Omit<SyntheticObservation, "availableAt">[] {
  const diary: Diary = {
    id: "fixture-diary-1", day: "2026-02-06", enteredAt: "2026-02-06T07:10:00.000Z",
    entryOffset: 120, mode: "contemporaneous", certainty: "high",
    ratings: { low: 1, elevated: "unknown", irritable: "skipped", energy: 2, sleepiness: 3, rested: 1, racing: "unknown" },
    wantedMore: "yes", activity: "usual", impulsivity: "", functioning: "Invented diary fixture",
    medication: "", substances: "", illness: "", travel: "", stress: "Invented context, not personal history",
  };
  return [
    ...syntheticImport().records.map(value => ({ id: `sleep:${value.id}`, revision: 1 as const, kind: "sleep" as const, value })),
    { id: diary.id, revision: 1, kind: "diary", value: diary },
    { id: "fixture-diary-2", revision: 1, kind: "diary", value: { ...diary, id: "fixture-diary-2", day: "2026-02-07", enteredAt: "2026-02-09T07:10:00.000Z", mode: "retrospective", certainty: "low" } },
  ];
}
export function syntheticObservations(availableAt: string): SyntheticObservation[] {
  return fixtureValues().map(value => ({ ...value, availableAt })) as SyntheticObservation[];
}
const archiveSchema = z.object({
  format: z.literal(1), mode: z.literal("synthetic"), revision: z.string().uuid(),
  importedAt: z.string().datetime(),
  observations: z.array(z.object({
    id: z.string().max(160), revision: z.literal(1), availableAt: z.string().datetime(),
    kind: z.enum(["sleep", "diary"]), value: z.unknown(),
  }).strict()).max(100),
}).strict();

export function validateSyntheticArchive(input: unknown): SyntheticArchive {
  const parsed = archiveSchema.parse(input);
  const allowed = new Map(fixtureValues().map(value => [value.id, value]));
  const seen = new Set<string>();
  for (const entry of parsed.observations) {
    const fixed = allowed.get(entry.id);
    if (seen.has(entry.id) || !fixed || entry.kind !== fixed.kind ||
      entry.availableAt !== parsed.importedAt || JSON.stringify(entry.value) !== JSON.stringify(fixed.value)) {
      throw new Error("INVALID_SYNTHETIC_ARCHIVE");
    }
    seen.add(entry.id);
  }
  return parsed as SyntheticArchive;
}
