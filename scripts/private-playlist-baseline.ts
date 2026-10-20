import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const values = process.argv.flatMap((value, index, all) => value === "--playlist" ? [all[index + 1]] : []).filter((value): value is string => Boolean(value));
if (!values.length) throw new Error("Usage: npm run private:playlist-baseline -- --playlist <playlist-id-or-url> [...]");

function playlistId(value: string) {
  const match = value.match(/(?:spotify\.com\/playlist\/)?([A-Za-z0-9]{22})/u);
  if (!match) throw new Error("Expected a Spotify playlist ID or URL.");
  return match[1];
}

const ids = [...new Set(values.map(playlistId))];
const directory = path.join(process.cwd(), "private-data", "vault");
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const target = path.join(directory, "spotify-baseline.private.json");
const existing = existsSync(target)
  ? JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown> & { playlistIds?: unknown }
  : undefined;
const existingIds = Array.isArray(existing?.playlistIds)
  ? existing.playlistIds.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9]{22}$/u.test(id))
  : [];
const playlistIds = [...new Set([...existingIds, ...ids])];
const capturedAt = typeof existing?.capturedAt === "string" ? existing.capturedAt : new Date().toISOString();
const temporary = `${target}.${process.pid}.tmp`;
writeFileSync(temporary, `${JSON.stringify({ ...existing, schemaVersion: 1, privacy: "private", canonical: false, reviewStatus: "pending", capturedAt, playlistIds }, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
renameSync(temporary, target);
chmodSync(target, 0o600);
console.log(JSON.stringify({ addedPlaylistIds: playlistIds.length - existingIds.length, storedPlaylistIds: playlistIds.length, target: "private-data/vault/spotify-baseline.private.json" }));
