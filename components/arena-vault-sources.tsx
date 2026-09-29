import { arenaChannels } from "@/lib/arena";

export function ArenaVaultSources() {
  return <section className="notebook-card vault-card">
    <p className="section-kicker">Are.na · field notes & digital art</p><h2>Two channels, one evolving practice.</h2>
    <p>Your Are.na channels remain the source. The reader follows up to seven entries per channel in their arranged order; rebuilding updates the route.</p>
    <ul>{arenaChannels.map((channel) => <li key={channel.slug}><b>{channel.role}</b> · <a href={channel.url} target="_blank" rel="noreferrer">{channel.title} ↗</a></li>)}</ul>
    <div className="experiment-actions"><a className="primary-button" href="/research/13a-forever">Walk the 13A Forever reader →</a></div>
    <p className="small-note">These are external research sources, not encrypted Vault records. Private Vault evidence is never sent to Are.na or included in the reader.</p>
    <details><summary>Research with the assistant · MCP</summary><p>Are.na MCP gives the assistant read access for exploring and proposing curation. Author decisions remain yours; this integration enables no write tools.</p><p>Server: <code>https://mcp.are.na/mcp</code>. Complete authentication in the assistant’s MCP settings. This page does not verify that connection or handle its credentials.</p><p>Suggested prompt: “Read up to seven entries from each of my two selected channels. Preserve source links and distinguish my field notes from references and project ideas. Propose changes without writing to Are.na or promoting anything to canon.”</p></details>
  </section>;
}
