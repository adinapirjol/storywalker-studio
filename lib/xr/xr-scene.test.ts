import { describe, expect, it } from "vitest";
import { cueGain, parseSceneFile, movementFeedback, DEMO_XR_SCENE, reviewExport, xrSceneSchema } from "./xr-scene";
describe("spatial listening boundaries", () => {
  const cue = DEMO_XR_SCENE.cues[0];
  it("never sounds pending, refused or over-budget cues", () => {
    expect(cueGain(cue, cue.x, cue.z, "pending", 60)).toBe(0);
    expect(cueGain(cue, cue.x, cue.z, "refused", 60)).toBe(0);
    expect(cueGain(cue, cue.x, cue.z, "accepted", 1)).toBe(0);
  });
  it("attenuates accepted sound and silences it beyond the boundary", () => {
    expect(cueGain(cue, cue.x, cue.z, "accepted", 60)).toBe(.08);
    expect(cueGain(cue, cue.x + cue.radius / 2, cue.z, "accepted", 60)).toBe(.04);
    expect(cueGain(cue, cue.x + cue.radius, cue.z, "accepted", 60)).toBe(0);
  });
  it("rejects raw/private extra fields, duplicate identifiers and invalid spatial inputs", () => {
    expect(xrSceneSchema.safeParse(DEMO_XR_SCENE).success).toBe(true);
    expect(xrSceneSchema.safeParse({ ...DEMO_XR_SCENE, rawHistory: [] }).success).toBe(false);
    expect(xrSceneSchema.safeParse({ ...DEMO_XR_SCENE, cues: [cue, cue] }).success).toBe(false);
    expect(xrSceneSchema.safeParse({ ...DEMO_XR_SCENE, cues: [{ ...cue, x: Infinity }] }).success).toBe(false);
  });
  it("retains refusals without converting decisions to canon or leaking unrelated decision keys", () => {
    const result = reviewExport(DEMO_XR_SCENE, { [cue.id]: "refused", unrelated: "accepted" });
    expect(result.canonical).toBe(false);
    expect(result.decisions[cue.id]).toBe("refused");
    expect(result.decisions.unrelated).toBeUndefined();
  });
});

describe("portable scene review", () => {
  it("round-trips positions, provenance, accept/refuse decisions without activation", () => {
    const scene = { ...DEMO_XR_SCENE, cues: DEMO_XR_SCENE.cues.map(cue => ({ ...cue, x: 3, radius: 4 })) };
    const file = JSON.parse(JSON.stringify({ ...reviewExport(scene, { listening: "accepted", screen: "refused" }), activated: false }));
    const parsed = parseSceneFile(file);
    expect(parsed.scene).toEqual(scene); expect(parsed.decisions).toEqual({ listening: "accepted", screen: "refused", making: "pending" });
    expect(() => parseSceneFile({ ...file, activated: true })).toThrow();
    expect(() => parseSceneFile({ ...file, decisions: { missing: "accepted" } })).toThrow();
  });
  it("continues to load old scene templates with pending decisions", () => {
    expect(parseSceneFile(DEMO_XR_SCENE)).toEqual({ scene: DEMO_XR_SCENE, decisions: {} });
  });
  it("explains movement independently of activation and audio", () => {
    const cue = DEMO_XR_SCENE.cues[0];
    expect(movementFeedback(cue, "accepted", false, false, 60)).toContain("Activate");
    expect(movementFeedback(cue, "accepted", true, false, 60)).toContain("Enable spatial sound");
    expect(movementFeedback({ ...cue, treatment: "silent" }, "accepted", true, true, 60)).toContain("silent visual");
    expect(movementFeedback(cue, "accepted", true, true, 60)).toContain("distance 0 m");
  });
});
