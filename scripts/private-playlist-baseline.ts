import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
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
const target = path.join(directory, "spotify-baseline.private.json");
writeFileSync(target, `${JSON.stringify({ schemaVersion: 1, privacy: "private", canonical: false, reviewStatus: "pending", capturedAt: new Date().toISOString(), playlistIds: ids }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(target, 0o600);
console.log(JSON.stringify({ storedPlaylistIds: ids.length, target }));
