import { z } from "zod";

export const arenaChannels = [
  { slug: "13a-forever-research", title: "13A Forever — research", role: "Field notes", url: "https://www.are.na/dinx-p/13a-forever-research" },
  { slug: "creative-tech-qyt0_4a6i2y", title: "Creative tech", role: "Digital art projects", url: "https://www.are.na/dinx-p/creative-tech-qyt0_4a6i2y" },
] as const;

export function safeArenaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password) return url.href; } catch { /* Missing media stays absent. */ }
}
export function safeEmbed(value: unknown): string | undefined {
  const url = safeArenaUrl(value);
  if (!url) return;
  const parsed = new URL(url);
  if ((["www.youtube.com", "www.youtube-nocookie.com"].includes(parsed.hostname) && parsed.pathname.startsWith("/embed/")) ||
    (parsed.hostname === "player.vimeo.com" && /^\/video\/\d+/.test(parsed.pathname)) ||
    (parsed.hostname === "w.soundcloud.com" && parsed.pathname === "/player/")) {
    parsed.searchParams.delete("autoplay"); parsed.searchParams.delete("auto_play");
    return parsed.href;
  }
}

const markdown = z.object({ plain: z.string() }).nullable().optional();
const image = z.object({ alt_text: z.string().nullable().optional(), src: z.string().optional(), medium: z.object({ src: z.string() }).optional() }).nullable().optional();
const entry = z.object({
  id: z.number().int(), type: z.string(), title: z.string().nullable().optional(), slug: z.string().optional(),
  visibility: z.string(), state: z.string(), content: markdown, description: markdown, image,
  connection: z.object({ position: z.number().int(), connected_at: z.string() }),
  source: z.object({ url: z.string() }).nullable().optional(),
  attachment: z.object({ url: z.string(), content_type: z.string().nullable().optional() }).nullable().optional(),
  embed: z.object({ url: z.string().nullable().optional() }).nullable().optional(),
});
export type ArenaFragment = {
  id: number; type: string; title: string; text: string; position: number; connectedAt: string;
  url: string; image?: string; alt: string; source?: string; media?: string; mediaType?: "audio" | "video";
  embed?: string; branchSlug?: string;
};
export type ArenaChannelSnapshot = {
  slug: string; title: string; role: string; url: string;
  status: "ready" | "unavailable"; checkedAt: string; notice?: string;
  fragments: ArenaFragment[]; total: number;
};
export type ArenaSnapshot = { channels: ArenaChannelSnapshot[] };

export function normaliseArenaContents(input: unknown): { fragments: ArenaFragment[]; total: number } {
  const result = z.object({ data: z.array(entry).max(7), meta: z.object({ total_count: z.number().int().nonnegative() }) }).parse(input);
  // Never send private/deleted entries into a build, even when a build token can see them.
  const fragments = result.data.filter((item) => ["public", "closed"].includes(item.visibility) && item.state === "available")
    .sort((a, b) => a.connection.position - b.connection.position).map((item): ArenaFragment => ({
      id: item.id, type: item.type, title: item.title || "Untitled fragment", text: item.content?.plain ?? item.description?.plain ?? "",
      position: item.connection.position, connectedAt: item.connection.connected_at,
      url: item.type === "Channel" ? `https://www.are.na/channel/${item.id}` : `https://www.are.na/block/${item.id}`,
      image: safeArenaUrl(item.image?.medium?.src ?? item.image?.src), alt: item.image?.alt_text || item.title || "Are.na visual fragment",
      source: safeArenaUrl(item.source?.url), media: safeArenaUrl(item.attachment?.url),
      mediaType: item.attachment?.content_type?.startsWith("audio/") ? "audio" : item.attachment?.content_type?.startsWith("video/") ? "video" : undefined,
      embed: safeEmbed(item.embed?.url), branchSlug: item.type === "Channel" ? item.slug : undefined,
    }));
  return { fragments, total: result.meta.total_count };
}

export function selectedConnections(snapshot: ArenaSnapshot, id: number): number {
  return snapshot.channels.filter((channel) => channel.fragments.some((fragment) => fragment.id === id && fragment.type !== "Channel")).length;
}
