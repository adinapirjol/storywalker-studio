import { arenaChannels } from "@/lib/arena";

export function ArenaVaultSources() {
  return <section className="notebook-card vault-card">
    <p className="section-kicker">Are.na · field notes & digital art</p><h2>Two channels, one evolving practice.</h2>
    <p>Your Are.na channels remain the source. The private reference field lets you orbit a saved snapshot, hold two fragments together and save your composition encrypted. The public reader remains a separate, limited snapshot.</p>
    <ul>{arenaChannels.map((channel) => <li key={channel.slug}><b>{channel.role}</b> · <a href={channel.url} target="_blank" rel="noreferrer">{channel.title} ↗</a></li>)}</ul>
    <div className="experiment-actions"><a className="primary-button" href="/research/arena-field">Open my private reference field →</a><a className="outline-button" href="/research/13a-forever">Public archive reader →</a></div>
    <p className="small-note">The private field imports a prepared MCP snapshot into this Vault when you open it. The public reader never receives private channel content. Neither experience sends Vault evidence or composition decisions to Are.na.</p>
    <details><summary>Research with the assistant · MCP</summary><p>Are.na MCP gives the assistant read access for exploring and proposing curation. Author decisions remain yours; this integration enables no write tools.</p><p>Server: <code>https://mcp.are.na/mcp</code>. Complete authentication in the assistant’s MCP settings. This page does not verify that connection or handle its credentials.</p><p>Suggested prompt: “Read up to seven entries from each of my two selected channels. Preserve source links and distinguish my field notes from references and project ideas. Propose changes without writing to Are.na or promoting anything to canon.”</p></details>
  </section>;
}
