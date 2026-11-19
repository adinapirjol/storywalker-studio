import type { LoopView } from "@/lib/nova/contracts";

export function SourceCoverage({ inventory }: Pick<LoopView, "inventory">) {
  const ready = inventory.filter(s => s.supported);
  const groups = new Map<string, number>();
  for (const source of inventory.filter(s => !s.supported)) {
    const category = source.id === "import:spotify-history:v1" ? "Spotify playback history — excluded; Last.fm supplies the listening trace"
      : source.id.startsWith("research-session:") ? "Research snapshots — only live Author editorial readings can be used"
      : source.kind === "capture" ? "Other saved records — this record format is not connected to Hyperloop"
      : source.kind === "reference" ? "Reference material — not yet connected to Hyperloop"
      : source.kind === "import" ? "Other imports — not yet connected to Hyperloop"
      : `${source.kind.replaceAll("-", " ")} records — not yet connected to Hyperloop`;
    groups.set(category, (groups.get(category) ?? 0) + 1);
  }
  return <details><summary>Sources · {ready.length} available for selection</summary>
    <ul>{ready.map(s => <li key={s.id}>{s.title} — {s.selected ? "in use" : "available, not selected"}</li>)}</ul>
    {groups.size > 0 && <><h3>Outside this loop</h3><p>These counts describe records Hyperloop cannot currently use, or that have restricted access. They are not missing titles or failed imports. Their contents have not been added to this analysis.</p>
      <ul>{[...groups].map(([label, count]) => <li key={label}>{label} · {count}</li>)}</ul></>}
    <p>Spotify’s role here is selected playlist context and your accounts of meaning, direction, encounters and remembered songs. A playlist addition alone does not establish any of those meanings.</p>
  </details>;
}
