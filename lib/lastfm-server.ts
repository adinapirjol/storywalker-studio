import { z } from "zod";

const lastFmResponseSchema = z.object({
  recenttracks: z.object({
    track: z.array(z.unknown()).or(z.unknown()).optional(),
    "@attr": z.object({ totalPages: z.string().optional() }).optional(),
  }).optional(),
  error: z.number().optional(),
  message: z.string().optional(),
});

export const lastFmEnvironmentSchema = z.object({
  LASTFM_API_KEY: z.string().trim().min(1),
});

export type LastFmWindow = { username: string; from: string; to: string };
export type LastFmReadResult = { recenttracks: { track: unknown[] }; pagination: { pagesRead: number; totalPages: number; complete: true } };

function unixSeconds(value: string, label: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`${label} must be a valid date.`);
  return Math.floor(timestamp / 1_000);
}

/** Reads a bounded, completed-scrobble window. The key remains server-side and
 * the returned response is immediately minimised before it enters the Vault. */
export async function readLastFmScrobbles(environment: z.infer<typeof lastFmEnvironmentSchema>, window: LastFmWindow): Promise<LastFmReadResult> {
  const username = window.username.trim();
  if (!/^[\p{L}\p{N}_-]{1,64}$/u.test(username)) throw new Error("Use a valid Last.fm username.");
  const from = unixSeconds(window.from, "From"); const to = unixSeconds(window.to, "To");
  if (to < from) throw new Error("The Last.fm end date must be after the start date.");
  if (to - from > 366 * 24 * 60 * 60) throw new Error("Choose a Last.fm window of one year or less for one local import.");

  const tracks: unknown[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.search = new URLSearchParams({ method: "user.getrecenttracks", user: username, api_key: environment.LASTFM_API_KEY, format: "json", from: String(from), to: String(to), limit: "200", page: String(page) }).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const parsed = lastFmResponseSchema.safeParse(await response.json());
    if (!response.ok || !parsed.success || parsed.data.error) {
      if (parsed.success && parsed.data.error === 17) throw new Error("Last.fm is keeping recent listening private. In Last.fm Settings → Privacy, turn off ‘Hide recent listening information’ to use this public-read importer, or keep it on and wait for a separate authenticated adapter.");
      throw new Error(parsed.success ? parsed.data.message ?? "Last.fm could not read this listening window." : "Last.fm returned an unexpected response.");
    }
    const pageTracks = parsed.data.recenttracks?.track;
    const items = Array.isArray(pageTracks) ? pageTracks : pageTracks ? [pageTracks] : [];
    tracks.push(...items);
    const reportedPages = Number(parsed.data.recenttracks?.["@attr"]?.totalPages ?? page);
    if (Number.isInteger(reportedPages) && reportedPages > 0) totalPages = Math.max(totalPages, reportedPages);
    if (totalPages > 1 && items.length === 0) throw new Error("Last.fm stopped returning results before the selected window was complete. Nothing was imported; retry the window later.");
    page += 1;
  } while (page <= totalPages);
  return { recenttracks: { track: tracks }, pagination: { pagesRead: totalPages, totalPages, complete: true } };
}
