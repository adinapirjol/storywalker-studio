"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { selectedConnections, type ArenaFragment, type ArenaSnapshot } from "@/lib/arena";
import styles from "./arena-reader.module.css";

function Media({ fragment, enabled }: { fragment: ArenaFragment; enabled: boolean }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = ref.current;
    if (media && enabled) void media.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
    return () => { media?.pause(); };
  }, [enabled]);
  if (!enabled) return <p>Sound is asleep. Enable media to listen at this stop.</p>;
  if (failed) return <p>Media could not load. <a href={fragment.url} target="_blank" rel="noreferrer">Listen on Are.na ↗</a></p>;
  if (fragment.media && fragment.mediaType === "audio") return <audio ref={(node) => { ref.current = node; }} src={fragment.media} controls preload="none" onError={() => setFailed(true)} />;
  if (fragment.media && fragment.mediaType === "video") return <video ref={(node) => { ref.current = node; }} src={fragment.media} controls playsInline preload="none" onError={() => setFailed(true)} />;
  if (fragment.embed) return <iframe title={fragment.title} src={fragment.embed} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen" referrerPolicy="no-referrer" />;
  return <a href={fragment.url} target="_blank" rel="noreferrer">Open this sound / film on Are.na ↗</a>;
}

export function ArenaReader({ snapshot }: { snapshot: ArenaSnapshot }) {
  const [channelIndex, setChannelIndex] = useState(0);
  const [stop, setStop] = useState(0);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const channel = snapshot.channels[channelIndex];
  const fragment = channel.fragments[stop];
  const connections = fragment ? selectedConnections(snapshot, fragment.id) : 0;
  function move(index: number) { setStop(index); setImageFailed(false); }
  function switchChannel(index: number) { setChannelIndex(index); move(0); }
  const branch = fragment?.branchSlug ? snapshot.channels.findIndex((item) => item.slug === fragment.branchSlug) : -1;

  return <main className={styles.reader}>
    <header className={styles.header}><a href="/vault">← Vault</a><span>13A / FOREVER READER · v0</span><button onClick={() => setMediaEnabled(!mediaEnabled)} aria-pressed={mediaEnabled}>{mediaEnabled ? "Disable media" : "Enable sound & video"}</button></header>
    <section className={styles.intro}><p>A route through a growing archive</p><h1>Things we<br /><em>carry forward.</em></h1><p>Two channels. Up to seven fragments each. An arrangement you can walk.</p></section>
    <nav className={styles.channels} aria-label="Choose an archive">{snapshot.channels.map((item, index) => <button key={item.slug} aria-pressed={index === channelIndex} onClick={() => switchChannel(index)}><small>0{index + 1}</small>{item.role}<span>{item.title}</span></button>)}</nav>
    <section className={styles.route} aria-label={channel.role}>
      <div className={styles.routeHeading}><p>{channel.role} / {channel.fragments.length} fragments</p><a href={channel.url} target="_blank" rel="noreferrer">Open channel ↗</a></div>
      {channel.status === "unavailable" ? <div className={styles.empty}><h2>This route is waiting for its fragments.</h2><p>{channel.notice}</p><p>No substitute memories have been added.</p></div> : !fragment ? <div className={styles.empty}><h2>An open beginning.</h2><p>No public fragments are available in this channel’s first seven positions. Add or reorder entries in Are.na, then rebuild.</p></div> : <>
        <nav className={styles.stops} aria-label="Route stops">{channel.fragments.map((item, index) => <button key={`${item.type}-${item.id}`} aria-label={`Stop ${index + 1}: ${item.title}`} aria-current={index === stop ? "step" : undefined} onClick={() => move(index)}>{String(index + 1).padStart(2, "0")}</button>)}</nav>
        <article key={`${channel.slug}-${fragment.id}`} className={styles.fragment} style={{ "--intensity": connections > 1 ? "1" : ".35" } as CSSProperties}>
          <div className={styles.fragmentMeta}><span>{fragment.type === "Channel" ? "Itinerary fork" : fragment.type}</span><span>Position {fragment.position}</span></div>
          {fragment.image && !imageFailed ? <img src={fragment.image} alt={fragment.alt} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : null}
          {imageFailed ? <p>Image unavailable. The original remains linked below.</p> : null}
          <h2>{fragment.title}</h2>
          {fragment.text ? <p className={fragment.type === "Text" ? styles.monologue : styles.description}>{fragment.text}</p> : null}
          {fragment.mediaType || fragment.type === "Embed" ? <Media fragment={fragment} enabled={mediaEnabled} /> : null}
          {fragment.type === "Channel" ? <div className={styles.fork}><p>Continue this route, or follow a branch.</p>{branch >= 0 ? <button onClick={() => switchChannel(branch)}>Follow {snapshot.channels[branch].role} →</button> : <a href={fragment.url} target="_blank" rel="noreferrer">Follow branch on Are.na ↗</a>}</div> : null}
          <footer><a href={fragment.url} target="_blank" rel="noreferrer">Original fragment ↗</a>{fragment.source ? <a href={fragment.source} target="_blank" rel="noreferrer">Source ↗</a> : null}<span>Entered archive: {fragment.connectedAt.slice(0, 10)}</span>{connections > 1 ? <span>Present in both selected routes · brighter here</span> : null}</footer>
        </article>
        <div className={styles.walk}><button disabled={stop === 0} onClick={() => move(stop - 1)}>← Previous</button><span>{stop + 1} / {channel.fragments.length}</span><button onClick={() => move(stop === channel.fragments.length - 1 ? 0 : stop + 1)}>{stop === channel.fragments.length - 1 ? "Walk again ↺" : "Next fragment →"}</button></div>
      </>}
    </section>
    <footer className={styles.notes}><p>{channel.checkedAt ? `Snapshot checked ${channel.checkedAt.replace("T", " ").slice(0, 16)} UTC.` : "Snapshot not built yet."} Channel changes appear after a rebuild.</p><p>Words and images remain attributed to their sources. A connection is an artistic cue, not a claim about a life. Brightness reflects overlap within these two selected routes, not a global connection count.</p><p>Media loads from its original host. Sound and embedded players activate only after you enable them.</p></footer>
  </main>;
}
