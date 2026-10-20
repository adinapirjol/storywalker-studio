import { z } from 'zod';

export const calendarEventSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  calendarId: z.string().min(1).max(1024),
  eventId: z.string().min(1).max(1024),
  title: z.string().max(1000),
  start: z.string().max(100), end: z.string().max(100),
  timeZone: z.string().max(100).optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  response: z.string().max(40).optional(),
  recurring: z.boolean(),
  fetchedAt: z.string().datetime({offset:true}),
}).strict();
export const calendarCatalogSchema = z.object({
  version: z.literal(1), from: z.string(), toExclusive: z.string(),
  complete: z.boolean(), events: z.array(calendarEventSchema).max(2000),
}).strict();
export const MAX_SYNC_PLAYLISTS = 20;
export const syncSettingsSchema = z.object({
  version: z.literal(1), watch: z.boolean(), lastfm: z.boolean(),
  spotifyIds: z.array(z.string().regex(/^[A-Za-z0-9]{10,64}$/)).max(MAX_SYNC_PLAYLISTS),
  calendarKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(2000),
}).strict();
export type SyncSettings = z.infer<typeof syncSettingsSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export const emptySettings: SyncSettings = {version:1,watch:false,lastfm:false,spotifyIds:[],calendarKeys:[]};

/** Suggestions are explicit title rules, never attendance or sensitive inference. */
export function suggestCalendarEvent(event: CalendarEvent) {
  if(event.status==='cancelled'||event.response==='declined') return 'Excluded: cancelled or declined';
  if(event.recurring) return 'Review recurring plan';
  if(/\b(flight|train|travel|airport|check.in|zbor|cazare)\b/iu.test(event.title)) return 'Suggested: travel plan';
  if(/\b(course|class|workshop|lecture|study|cours|curs|masterclass)\b/iu.test(event.title)) return 'Suggested: learning plan';
  if(/\b(festival|concert|exhibition|museum|performance|cinema|film|show|teatru)\b/iu.test(event.title)) return 'Suggested: cultural plan';
  return 'Review individually';
}
