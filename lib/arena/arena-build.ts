import { arenaChannels, normaliseArenaContents, type ArenaChannelSnapshot, type ArenaSnapshot } from "./arena";

export async function buildArenaSnapshot(request: typeof fetch = fetch, token?: string): Promise<ArenaSnapshot> {
  const channels: ArenaChannelSnapshot[] = [];
  for (const channel of arenaChannels) {
    const base = { ...channel, checkedAt: new Date().toISOString(), fragments: [], total: 0 };
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const get = async (suffix: string) => {
        const response = await request(`https://api.are.na/v3/channels/${channel.slug}${suffix}`, { headers, redirect: "error", signal: AbortSignal.timeout(15_000), cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Are.na requires authorization for this read." : response.status === 429 ? "Are.na rate limit reached. Rebuild after the rate-limit window." : `Are.na returned HTTP ${response.status}.`);
        return response.json();
      };
      const metadata = await get("");
      if (!["public", "closed"].includes(metadata.visibility) || metadata.state !== "available") throw new Error("This channel is not publicly readable. Its contents are excluded from the artwork.");
      const contents = normaliseArenaContents(await get("/contents?per=7&page=1&sort=position_asc"));
      channels.push({ ...base, ...contents, status: "ready" });
    } catch (error) {
      // Clear old material on failure rather than leaking a formerly public snapshot.
      const knownError = error instanceof Error && (error.message.startsWith("Are.na") || error.message.startsWith("This channel"));
      const notice = knownError ? error.message : "The channel could not be verified. Rebuild when Are.na is reachable.";
      channels.push({ ...base, status: "unavailable", notice });
    }
  }
  return { channels };
}
