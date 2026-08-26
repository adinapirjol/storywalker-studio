import { describe, expect, it } from "vitest";
import { selectedPrivateTraceAdapter, selectedLinzTracesSchema } from "@/lib/private-linz";

const traces = ["a", "b", "c"].map((id) => ({ id, generalisedLocation: "Generalised place", approximateInterval: "2026-08-01 afternoon", timezone: "Europe/Bucharest", spotifyUri: "spotify:track:demo", songLabel: "Synthetic test track", occurred: "Synthetic test record.", acceptedInterpretation: "Accepted only in test.", refusedInterpretation: "Refused only in test.", provenance: "Synthetic test fixture", privacyClassification: "local-private" as const }));

describe("selected local Linz traces", () => {
  it("requires exactly three deliberately selected local records", () => {
    expect(selectedLinzTracesSchema.parse(traces)).toHaveLength(3);
    expect(() => selectedLinzTracesSchema.parse(traces.slice(0, 2))).toThrow();
  });
  it("exposes only minimised fields through the local adapter", async () => {
    const records = await selectedPrivateTraceAdapter(traces).loadMinimised();
    expect(records[0]).toMatchObject({ locationPrecision: "generalised", privacy: "local-private" });
    expect(records[0]).not.toHaveProperty("acceptedInterpretation");
    expect(records[0]).not.toHaveProperty("refusedInterpretation");
  });
});
