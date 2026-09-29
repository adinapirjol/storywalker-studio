import { minimisedLastFmHistorySchema } from "./private-ingest";

type Play = { playedAt: string; trackName: string; artistName: string; albumName?: string };
const dayMs = 86400000;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function analyseListening(input: unknown, from: string, to: string, timeZone = "Europe/Bucharest") {
  const document = minimisedLastFmHistorySchema.parse(input);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || from > to) throw new Error("Invalid analysis dates");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dateOf = (play: Play) => formatter.format(new Date(play.playedAt));
  const days = Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / dayMs) + 1 }, (_, i) => new Date(Date.parse(from) + i * dayMs).toISOString().slice(0, 10));
  if (days.length > 367) throw new Error("Choose at most one year");
  const seen = new Set<string>(); let duplicates = 0;
  const plays = document.records.filter(play => {
    const date = dateOf(play);
    if (date < from || date > to) return false;
    const key = JSON.stringify([Date.parse(play.playedAt), play.artistName, play.trackName, play.albumName ?? ""]);
    if (seen.has(key)) { duplicates++; return false; }
    seen.add(key); return true;
  }).sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || compare(a.artistName, b.artistName) || compare(a.trackName, b.trackName));
  const week = (play: Play) => Math.floor((Date.parse(dateOf(play)) - Date.parse(from)) / dayMs / 7);
  function ranking(selected: Play[], kind: "artist" | "track" | "album") {
    const groups = new Map<string, Play[]>();
    for (const play of selected) {
      if (kind === "album" && !play.albumName) continue;
      const key = JSON.stringify(kind === "artist" ? [play.artistName] : [play.artistName, kind === "track" ? play.trackName : play.albumName]);
      groups.set(key, [...(groups.get(key) ?? []), play]);
    }
    return [...groups].map(([key, rows]) => ({ key, label: (JSON.parse(key) as string[]).join(" — "), count: rows.length, activeDays: new Set(rows.map(dateOf)).size, activeWeeks: new Set(rows.map(week)).size, first: rows[0].playedAt, last: rows[rows.length - 1].playedAt })).sort((a, b) => b.count - a.count || compare(a.key, b.key));
  }
  const daily = days.map(date => { const rows = plays.filter(p => dateOf(p) === date); const top = ranking(rows, "artist")[0]; return { date, count: rows.length, topArtist: top?.label ?? null, topShare: rows.length ? (top?.count ?? 0) / rows.length : 0 }; });
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => {
    const rows = plays.filter(p => week(p) === index); const artists = ranking(rows, "artist");
    return { from: days[index * 7], to: days[Math.min(index * 7 + 6, days.length - 1)], count: rows.length, artists, dominant: rows.length >= 10 && artists[0]?.count / rows.length >= .3 ? artists[0].label : null };
  });
  const eras: { from: string; to: string; label: string; count: number }[] = [];
  for (const window of weeks) {
    const label = window.dominant ? `Observed dominant artist: ${window.dominant}` : window.count ? "Mixed / insufficient counts for dominance" : "No records available";
    const previous = eras[eras.length - 1];
    if (previous?.label === label) { previous.to = window.to; previous.count += window.count; } else eras.push({ from: window.from, to: window.to, label, count: window.count });
  }
  const nonzero = daily.filter(d => d.count).map(d => d.count).sort((a, b) => a - b);
  const burstThreshold = Math.max(10, nonzero[Math.max(0, Math.ceil(nonzero.length * .9) - 1)] ?? 10);
  const transitions = weeks.slice(1).flatMap((current, index) => {
    const previous = weeks[index];
    if (current.count < 10 || previous.count < 10) return [];
    const keys = new Set([...current.artists, ...previous.artists].map(a => a.key));
    const distance = [...keys].reduce((sum, key) => sum + Math.abs((current.artists.find(a => a.key === key)?.count ?? 0) / current.count - (previous.artists.find(a => a.key === key)?.count ?? 0) / previous.count), 0) / 2;
    return distance >= .5 ? [{ previousFrom: previous.from, from: current.from, distributionChange: distance, previousTop: previous.artists[0].label, currentTop: current.artists[0].label }] : [];
  });
  const artists = ranking(plays, "artist"), tracks = ranking(plays, "track"), albums = ranking(plays, "album");
  const lastDay = plays.length ? dateOf(plays[plays.length - 1]) : null;
  const absences = lastDay ? artists.filter(a => a.count >= 5 && (Date.parse(lastDay) - Date.parse(formatter.format(new Date(a.last)))) / dayMs >= 14).map(a => ({ ...a, observedDaysSinceLast: Math.floor((Date.parse(lastDay) - Date.parse(formatter.format(new Date(a.last)))) / dayMs) })) : [];
  const candidates = [
    ...artists.filter(a => a.activeWeeks >= 3).slice(0, 3).map(a => ({ ...a, kind: "recurring artist", reason: `${a.count} scrobbles across ${a.activeWeeks} observed weeks` })),
    ...tracks.filter(a => a.count >= 2).slice(0, 2).map(a => ({ ...a, kind: "recurring track", reason: `${a.count} scrobbles across ${a.activeDays} days` })),
    ...albums.filter(a => a.count >= 2).slice(0, 2).map(a => ({ ...a, kind: "album", reason: `${a.count} scrobbles with this album field` })),
  ];
  return { version: 1, method: "fixed-week-counts-v1", from, to, timeZone, importedAt: document.importedAt, total: plays.length, duplicatesRemoved: duplicates, first: plays[0]?.playedAt ?? null, last: plays.at(-1)?.playedAt ?? null,
    completedDeltaReads: [] as Array<{ from: string; to: string; pagesRead: number; complete: boolean }>,
    coverage: "Available records only. Original requested import window and pagination were not retained; complete coverage cannot be established. Empty dates are unknown, not confirmed silence. The final day may still be in progress.",
    rules: { eras: "Consecutive fixed 7-day windows, anchored to requested start; >=10 plays and top artist share >=30%. Mixed and absent-data bins are not musical eras.", bursts: `Daily count >= ${burstThreshold} (max of 10 and nonzero-day 90th percentile).`, concentrations: "At least 10 daily plays and top artist share >=60%.", transitions: "Adjacent weeks each >=10 plays; total variation distance >=0.5.", absences: "Artist >=5 plays, absent >=14 days before latest observed day. Absence from records only, not evidence of stopped listening.", candidates: "Top 3 artists with >=3 active weeks, top 2 tracks and albums with >=2 plays; counts descending, exact text key breaks ties. Exact text grouping, no inferred alias merging." },
    daily, weeks, eras, bursts: daily.filter(d => d.count >= burstThreshold), concentrations: daily.filter(d => d.count >= 10 && d.topShare >= .6), transitions, artists, tracks, albums, absences, candidates };
}
export type ListeningAnalysis = ReturnType<typeof analyseListening>;
