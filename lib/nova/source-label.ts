import type { VaultRecord } from "@/lib/vault/private-vault";

/** Small display-only metadata for choosing a source; never an inference input. */
export type SourceLabel = { title: string; description: string };
const text = (value: unknown, limit = 240) => typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
const categories: Record<string, string> = { event: "Event", application: "Application", playlist: "Playlist note", reference: "Reference", "work-update": "Work update", travel: "Travel", idea: "Idea" };
const statuses: Record<string, string> = { happened: "Recorded as happened", planned: "Planned", applied: "Applied", "not-selected": "Not selected", "in-progress": "In progress", uncertain: "Uncertain" };
export function sourceLabel(header: Pick<VaultRecord, "id" | "kind">, capture?: VaultRecord): SourceLabel {
  if (header.id.startsWith("import:spotify-playlist:")) {
    const p = capture?.payload as { snapshot?: { playlist?: { name?: unknown } } } | undefined;
    return { title: text(p?.snapshot?.playlist?.name) ?? "Saved Spotify playlist", description: "Playlist context. Add your own meaning, direction, encounters or memories; metadata alone cannot supply them." };
  }
  if (header.id === "import:lastfm-history:v1") return { title: "Last.fm listening history", description: "Imported scrobbles: tracks, artists and recorded listening times. This is listening history, not a playlist." };
  if (header.id === "import:spotify-history:v1") return { title: "Spotify listening history", description: "Imported playback records: tracks, artists and playback end times. This is listening history, not your saved playlists." };
  if (!capture && header.kind === "capture" && !header.id.startsWith("capture:")) return { title: header.id.startsWith("research-session:") ? "Research snapshot" : "Other saved record", description: "This record format is outside the current loop; its title has not been read." };
  if (header.kind === "capture") {
    const p = capture?.payload && typeof capture.payload === "object" && !Array.isArray(capture.payload) ? capture.payload as Record<string, unknown> : {};
    const category = typeof p.kind === "string" ? categories[p.kind] : undefined;
    const status = typeof p.status === "string" ? statuses[p.status] : undefined;
    const when = text(p.when, 120);
    return { title: text(p.title) ?? "Untitled saved note", description: ["Your saved note", category, status, when ? `When: ${when}` : "Event date not recorded"].filter(Boolean).join(" · ") };
  }
  return { title: `${header.kind.replaceAll("-", " ")} source`, description: "This source type is not yet available for Hypothesis Hyperloop." };
}
