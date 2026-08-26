import { z } from "zod";
import { privacySchema, reviewStatusSchema } from "@/lib/schema";

export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().nonnegative().optional(),
});

export const echoSchema = z.object({
  id: z.string().regex(/^fictional-echo-[a-z0-9-]+$/u),
  title: z.string().min(1),
  centre: coordinateSchema.omit({ accuracyMeters: true }),
  radiusMeters: z.number().positive(),
  transcript: z.string().min(1),
  audioSourceKind: z.enum(["synthetic", "local-file"]),
  triggerPolicy: z.enum(["one-shot", "re-entry"]),
  privacy: privacySchema,
  provenance: z.string().min(1),
  uncertainty: z.string().min(1),
  reviewStatus: reviewStatusSchema,
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type Echo = z.infer<typeof echoSchema>;
export type ZoneEventKind = "entered" | "remaining" | "left" | "outside" | "uncertain";

export interface ZoneEvent {
  echoId: string;
  kind: ZoneEventKind;
  distanceMeters: number;
  triggered: boolean;
}

export interface LocativeSession {
  insideEchoIds: string[];
  triggeredEchoIds: string[];
  refusedEchoIds: string[];
  lastEvents: ZoneEvent[];
}

export const FICTIONAL_ECHOES: Echo[] = [
  {
    id: "fictional-echo-threshold",
    title: "Threshold / a possible beginning",
    centre: { latitude: 0, longitude: 0 },
    radiusMeters: 90,
    transcript: "A synthetic two-note figure marks a fictional threshold. It does not prove what being here means.",
    audioSourceKind: "synthetic",
    triggerPolicy: "one-shot",
    privacy: "public",
    provenance: "Fictional Aurora Coast experiment fixture.",
    uncertainty: "GPS accuracy can make the boundary indeterminate; use the manual controls if it is wider than 45 metres.",
    reviewStatus: "pending",
  },
  {
    id: "fictional-echo-return",
    title: "Return / a revisable trace",
    centre: { latitude: 0, longitude: 0.002 },
    radiusMeters: 90,
    transcript: "A transformed synthetic figure may play on each re-entry. Movement is a trigger, not an interpretation.",
    audioSourceKind: "synthetic",
    triggerPolicy: "re-entry",
    privacy: "public",
    provenance: "Fictional Aurora Coast experiment fixture.",
    uncertainty: "The zone is a rough circular model, not a precise map or a claim about a real place.",
    reviewStatus: "pending",
  },
];

export function haversineDistanceMeters(a: Coordinate, b: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLatitude = radians(b.latitude - a.latitude);
  const dLongitude = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function createLocativeSession(): LocativeSession {
  return { insideEchoIds: [], triggeredEchoIds: [], refusedEchoIds: [], lastEvents: [] };
}

export function resetLocativeSession(): LocativeSession {
  return createLocativeSession();
}

export function processLocativePosition(
  echoes: Echo[],
  position: Coordinate,
  previous: LocativeSession,
): LocativeSession {
  const inside = new Set(previous.insideEchoIds);
  const triggered = new Set(previous.triggeredEchoIds);
  const events = echoes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((echo) => {
      const distanceMeters = haversineDistanceMeters(position, echo.centre);
      const accuracyIsUseful =
        position.accuracyMeters === undefined || position.accuracyMeters <= echo.radiusMeters / 2;
      if (!accuracyIsUseful) {
        return { echoId: echo.id, kind: "uncertain" as const, distanceMeters, triggered: false };
      }
      const wasInside = inside.has(echo.id);
      const isInside = distanceMeters <= echo.radiusMeters;
      if (!isInside) {
        inside.delete(echo.id);
        return {
          echoId: echo.id,
          kind: wasInside ? ("left" as const) : ("outside" as const),
          distanceMeters,
          triggered: false,
        };
      }
      inside.add(echo.id);
      if (wasInside) {
        return { echoId: echo.id, kind: "remaining" as const, distanceMeters, triggered: false };
      }
      const mayTrigger = echo.triggerPolicy === "re-entry" || !triggered.has(echo.id);
      if (mayTrigger) triggered.add(echo.id);
      return { echoId: echo.id, kind: "entered" as const, distanceMeters, triggered: mayTrigger };
    });
  return {
    ...previous,
    insideEchoIds: [...inside].sort(),
    triggeredEchoIds: [...triggered].sort(),
    lastEvents: events,
  };
}

export function refuseActivatedEcho(session: LocativeSession, echoId: string): LocativeSession {
  if (!session.triggeredEchoIds.includes(echoId)) return session;
  return {
    ...session,
    refusedEchoIds: [...new Set([...session.refusedEchoIds, echoId])].sort(),
  };
}

export function canStartLocation(acknowledged: boolean, geolocationAvailable: boolean) {
  return acknowledged && geolocationAvailable;
}
