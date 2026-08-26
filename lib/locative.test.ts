import { describe, expect, it } from "vitest";
import {
  canStartLocation,
  createLocativeSession,
  FICTIONAL_ECHOES,
  haversineDistanceMeters,
  processLocativePosition,
  refuseActivatedEcho,
  resetLocativeSession,
} from "@/lib/locative";

describe("locative Echo domain", () => {
  it("calculates Haversine distance and includes the circular boundary", () => {
    expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 })).toBeCloseTo(111.2, 0);
    const boundary = { ...FICTIONAL_ECHOES[0].centre, longitude: 90 / 111_195 };
    const session = processLocativePosition([FICTIONAL_ECHOES[0]], boundary, createLocativeSession());
    expect(session.lastEvents[0].kind).toBe("entered");
  });

  it("orders events deterministically and supports one-shot and re-entry triggers", () => {
    const threshold = FICTIONAL_ECHOES.find((echo) => echo.triggerPolicy === "one-shot")!;
    const returning = FICTIONAL_ECHOES.find((echo) => echo.triggerPolicy === "re-entry")!;
    let session = createLocativeSession();
    session = processLocativePosition([returning, threshold], { latitude: 0, longitude: 0 }, session);
    expect(session.lastEvents.map((event) => event.echoId)).toEqual([threshold.id, returning.id].sort());
    expect(session.lastEvents.find((event) => event.echoId === threshold.id)?.triggered).toBe(true);
    session = processLocativePosition([threshold], { latitude: 0, longitude: 0.004 }, session);
    expect(session.lastEvents[0].kind).toBe("left");
    session = processLocativePosition([threshold], { latitude: 0, longitude: 0 }, session);
    expect(session.lastEvents[0]).toMatchObject({ kind: "entered", triggered: false });
    let reentry = createLocativeSession();
    reentry = processLocativePosition([returning], { latitude: 0, longitude: 0.002 }, reentry);
    reentry = processLocativePosition([returning], { latitude: 0, longitude: 0.004 }, reentry);
    reentry = processLocativePosition([returning], { latitude: 0, longitude: 0.002 }, reentry);
    expect(reentry.lastEvents[0]).toMatchObject({ kind: "entered", triggered: true });
  });

  it("treats weak accuracy as uncertainty, supports refusal, consent gating, and reset", () => {
    const echo = FICTIONAL_ECHOES[0];
    const uncertain = processLocativePosition([echo], { ...echo.centre, accuracyMeters: 60 }, createLocativeSession());
    expect(uncertain.lastEvents[0]).toMatchObject({ kind: "uncertain", triggered: false });
    const active = processLocativePosition([echo], echo.centre, createLocativeSession());
    expect(refuseActivatedEcho(active, echo.id).refusedEchoIds).toEqual([echo.id]);
    expect(canStartLocation(false, true)).toBe(false);
    expect(canStartLocation(true, false)).toBe(false);
    expect(canStartLocation(true, true)).toBe(true);
    expect(resetLocativeSession()).toEqual(createLocativeSession());
  });
});
