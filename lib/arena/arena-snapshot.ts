import { readFile } from "node:fs/promises";
import { arenaChannels, type ArenaSnapshot } from "./arena";

// Server-only file access. The client receives only the selected public snapshot.
export async function readArenaSnapshot(): Promise<ArenaSnapshot> {
  try { return JSON.parse(await readFile(".arena/snapshot.json", "utf8")) as ArenaSnapshot; }
  catch { return { channels: arenaChannels.map((channel) => ({ ...channel, status: "unavailable", checkedAt: "", fragments: [], total: 0, notice: "No build snapshot yet. Run npm run arena:refresh, then rebuild." })) }; }
}
