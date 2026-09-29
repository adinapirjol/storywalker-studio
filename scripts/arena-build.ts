import { mkdir, rename, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { buildArenaSnapshot } from "../lib/arena-build";

async function main() {
  loadEnvConfig(process.cwd());
  const snapshot = await buildArenaSnapshot(fetch, process.env.ARENA_READ_TOKEN);
  await mkdir(".arena", { recursive: true });
  await writeFile(".arena/snapshot.tmp", JSON.stringify(snapshot), { mode: 0o600 });
  await rename(".arena/snapshot.tmp", ".arena/snapshot.json");
  for (const channel of snapshot.channels) console.log(`${channel.role}: ${channel.status}; ${channel.fragments.length} selected entries.${channel.notice ? ` ${channel.notice}` : ""}`);
}

main().catch(() => { console.error("Could not write the Are.na snapshot. Build stopped."); process.exitCode = 1; });
