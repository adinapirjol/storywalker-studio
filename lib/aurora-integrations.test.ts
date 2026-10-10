import { expect, it, vi } from "vitest";
import { auroraBatch, auroraBodyState, auroraIntegrationCases } from "./aurora-integrations";
import { bodyWindows } from "./body-composition";
import { evaluateHealthThresholds } from "./native-transfer";
import type { Observation, ValidatedTransfer } from "./native-transfer-contract";

it("keeps Aurora public evidence fictional, paused and isolated", () => {
  const first = auroraBodyState();
  expect(first.observations.every((item) => item.source_type === "fictional" && item.acquisition === "simulated")).toBe(true);
  expect(bodyWindows(first).length).toBeGreaterThan(0);
  first.observations.length = 0;
  expect(auroraBodyState().observations.length).toBeGreaterThan(0);
  expect(auroraBatch.mode).toBe("simulated");
  expect(auroraBatch.timing?.receivedStart).toBe("2030-05-01T12:00:03Z");
});

it("checks public examples against the production Pydantic evaluator, without export", async () => {
  const outbound = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline fixture must not export"));
  const at = (second: number) => new Date(Date.parse(auroraIntegrationCases.base_time) + second * 1000).toISOString();
  try {
    for (const scenario of auroraIntegrationCases.cases) {
      const observations: Observation[] = scenario.samples.map((sample) => ({
        schema_version: 1, id: `aurora-${sample.source}-${sample.second}`, source_id: `invented-${sample.source}`,
        source_type: "healthkit", source_revision: "fictional-test", device_revision: null,
        event_start: at(sample.second), event_end: at(sample.second), received_at: at(sample.second + 3),
        original_offset: "+00:00", semantics: "measurement", acquisition: "live", provenance: "source_recorded",
        quality: sample.source === "watch" ? ["recorded_on_apple_watch"] : [], payload: { kind: "heart_rate", value: sample.bpm, unit: "bpm" },
      }));
      // HealthKit roles exist only in this isolated test, never in the public transport.
      const batch: ValidatedTransfer = { version: 1, batch_id: `aurora-test-${scenario.id}`, mode: "healthkit", observations, deletions: [] };
      const rule = { rest_only: scenario.rest_only ?? false, min_samples: 2 };
      const now = at(scenario.now_second ?? Math.max(...scenario.samples.map((sample) => sample.second)) + 3);
      const result = await evaluateHealthThresholds(rule, undefined, batch, now);
      expect(result.events.map((event) => event.kind), scenario.id).toEqual(scenario.expected_kinds);
      const simulated = await evaluateHealthThresholds(rule, undefined, { ...batch, mode: "simulated" }, now);
      expect(simulated.events, scenario.id).toEqual([]);
    }
    expect(outbound).not.toHaveBeenCalled();
  } finally { outbound.mockRestore(); }
}, 15_000);
