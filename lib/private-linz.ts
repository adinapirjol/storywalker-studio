import { z } from "zod";
import type { PrivateTraceAdapter, PrivateTraceRecord } from "@/lib/public-context";

export const selectedLinzTraceSchema = z.object({
  id: z.string().min(1),
  generalisedLocation: z.string().min(1),
  approximateInterval: z.string().min(1),
  timezone: z.string().min(1),
  spotifyUri: z.string().startsWith("spotify:track:").optional(),
  songLabel: z.string().min(1),
  occurred: z.string().min(1).max(500),
  acceptedInterpretation: z.string().min(1).max(500),
  refusedInterpretation: z.string().min(1).max(500),
  provenance: z.string().min(1),
  privacyClassification: z.literal("local-private"),
});
export const selectedLinzTracesSchema = z.array(selectedLinzTraceSchema).length(3);
export type SelectedLinzTrace = z.infer<typeof selectedLinzTraceSchema>;

/** This adapter is data-only and intentionally has no browser file-system implementation. */
export function selectedPrivateTraceAdapter(records: SelectedLinzTrace[]): PrivateTraceAdapter {
  const selected = selectedLinzTracesSchema.parse(records);
  return { id: "author-selected-linz-private-traces", async loadMinimised() { return selected.map((record): PrivateTraceRecord => ({ id: record.id, occurredAt: record.approximateInterval, timezone: record.timezone, locationLabel: record.generalisedLocation, locationPrecision: "generalised", spotifyUri: record.spotifyUri, trackLabel: record.songLabel, fragment: record.occurred, provenance: record.provenance, privacy: "local-private" })); } };
}
