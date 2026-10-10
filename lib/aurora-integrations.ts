import original from "./body-preview.fictional.json";
import rehearsal from "../examples/aurora-coast/integration-cases.demo.json";
import type { ContextState } from "./context-contract";
import type { NativeSummary } from "./native-transfer";

export const auroraIntegrationCases = rehearsal;

/** Public design fixture only: no Vault or telemetry adapters are imported. */
export function auroraBodyState(): ContextState {
  const state = structuredClone(original) as ContextState;
  state.status = "Aurora Coast · fictional, paused rehearsal";
  for (const observation of state.observations) {
    if (observation.payload.kind === "location") {
      observation.payload.label = "Invented Aurora harbour";
      observation.payload.city = "Aurora Harbour";
      observation.payload.country = "Fictional coastline";
    }
  }
  return state;
}

export const auroraBatch: NativeSummary = {
  id: "native:batch:00000000-0000-4000-8000-000000000001",
  mode: "simulated",
  status: "pending-review",
  revision: 1,
  count: 2,
  deletionCount: 0,
  validatedAt: "2030-05-01T12:00:09Z",
  timing: {
    measuredStart: "2030-05-01T12:00:00Z",
    measuredEnd: "2030-05-01T12:00:05Z",
    receivedStart: "2030-05-01T12:00:03Z",
    receivedEnd: "2030-05-01T12:00:08Z",
  },
};
