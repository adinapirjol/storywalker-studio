import { z } from "zod";
import type { Diary, SleepRecord } from "./model";

/** This contract deliberately has no arbitrary observation-write operation. */
const revision = z.string().uuid().nullable();
export const rehearsalCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed"), expectedRevision: revision }).strict(),
  z.object({ action: z.literal("delete-all"), expectedRevision: revision }).strict(),
  z.object({ action: z.literal("delete-sleep-batch"), expectedRevision: revision }).strict(),
  z.object({ action: z.literal("delete-observation"), expectedRevision: revision, id: z.string().max(160) }).strict(),
]);
export type RehearsalCommand = z.infer<typeof rehearsalCommand>;
export type SyntheticObservation = {
  id: string;
  revision: 1;
  availableAt: string;
} & ({ kind: "sleep"; value: SleepRecord } | { kind: "diary"; value: Diary });
export type SyntheticArchive = {
  format: 1;
  mode: "synthetic";
  revision: string;
  importedAt: string;
  observations: SyntheticObservation[];
};

const token = z.string().regex(/^[a-f0-9]{64}$/).nullable();
const recoveryFields = { expectedCurrentToken: token, expectedBackupToken: token };
const recoveryCode = z.string().regex(/^[a-f0-9]{64}$/);
export const recoveryCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-backup"), ...recoveryFields, recoveryCode }).strict(),
  z.object({ action: z.literal("preview-restore"), ...recoveryFields, recoveryCode }).strict(),
  z.object({ action: z.literal("restore-backup"), ...recoveryFields, recoveryCode, confirmReplace: z.literal(true) }).strict(),
  z.object({ action: z.literal("delete-backup"), ...recoveryFields, confirmDelete: z.literal(true) }).strict(),
]);
export type RecoveryCommand = z.infer<typeof recoveryCommand>;
export type RecoveryStatus = { currentToken: string | null; backupToken: string | null };
export type RecoveryPreview = { observations: number; revision: string };
