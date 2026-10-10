"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Music2, NotebookPen, Radio, ShieldCheck } from "lucide-react";

type SpotifyStatus = { configured: boolean; mode: string; permissions: string[] };

export function StorywalkerOnboarding() {
  const [spotify, setSpotify] = useState<SpotifyStatus>();
  useEffect(() => { fetch("/api/connectors/spotify", { cache: "no-store" }).then((response) => response.json()).then(setSpotify).catch(() => setSpotify({ configured: false, mode: "demo-only", permissions: [] })); }, []);
  return <main className="research-main onboarding-main">
    <section className="experiment-hero"><p className="eyebrow"><span /> Make Storywalker yours</p><h1>The magic is immediate. Your data enters only on purpose.</h1><p>Start with a fictional demonstration, then create a private local Vault and progressively connect or import the traces you want to work with.</p></section>
    <section className="onboarding-path" aria-label="Storywalker setup path">
      <article><span className="onboarding-number">01</span><NotebookPen /><p className="section-kicker">Try the shape</p><h2>Start with a real-looking fictional journal</h2><p>The demo shows the relationship between moments, music, and uncertainty without asking for an account.</p><a className="outline-button" href="/">Open the demo <ArrowRight size={15} /></a></article>
      <article><span className="onboarding-number">02</span><LockKeyhole /><p className="section-kicker">Keep the notebook sealed</p><h2>Create an encrypted personal Vault</h2><p>Private records, imports, and drafts stay local. You decide what remains evidence, what is revised, and what is refused.</p><a className="primary-button" href="/vault">Open private Vault <ArrowRight size={15} /></a></article>
      <article><span className="onboarding-number">03</span><Radio /><p className="section-kicker">Choose sources</p><h2>Bring in the signals that matter now</h2><p>Spotify can become the first connected source. Timeline and ChatGPT history are intentionally guided local imports, not invisible account scraping.</p></article>
    </section>
    <section className="connector-card"><div><p className="section-kicker">Spotify · first connected source</p><h2>Four owned playlists, plus recent listening</h2><p>After consent, Storywalker will suggest up to four playlists you own (not collaborative ones), based on overlap with recent listening. You can revise the selection before any import.</p><div className="permission-row"><ShieldCheck size={15} /> Read-only: {spotify?.permissions.join(" · ") || "checking local setup…"}</div></div><div className="connector-status"><Music2 size={22} /><b>{spotify?.configured ? "Local Spotify configuration detected" : "Demo connector ready"}</b><p>{spotify?.configured ? "The next implementation slice can open the local consent flow." : "A shared hosted OAuth client is needed for no-setup account connection; a clone still has the full demo and local import path."}</p><span className={spotify?.configured ? "verified-pill" : "status-pill pending"}>{spotify?.configured ? <><CheckCircle2 size={13} /> configured</> : "no account requested"}</span></div></section>
    <section className="onboarding-privacy"><h2>Two surfaces, one deliberate boundary</h2><div><article><b>Private notebook</b><p>Evidence, source records, searches, and correlations stay encrypted in the Vault.</p></article><article><b>Public voice</b><p>You select evidence, write a draft, and export it yourself. There is no background publishing.</p><a className="outline-button" href="/voice">Open Public Voice <ArrowRight size={15} /></a></article></div></section>
  </main>;
}
