"use client";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clamp, INITIAL_CAMERA, projectRoom, projectSegment, unprojectRoom, VIEW, zoomCamera, type JourneyCamera, type RoomPoint } from "@/lib/journey-camera";
import type { JourneyEpisode } from "@/lib/journey-episode";
import { episodeIdentifiers } from "@/lib/journey-identifiers";
import { journeyAtTime } from "@/lib/journey-basemap";
import type { XRScene } from "@/lib/xr-scene";
import { XRGeographyLayer } from "./xr-geography-layer";
import { XRJourneyGlobe } from "./xr-journey-globe";
import { GLOBE_CAMERA, episodeGeography, globeZoom, type GlobeCamera } from "@/lib/journey-globe";
import styles from "./xr-lab.module.css";

type Props = { episodes: JourneyEpisode[]; mode: "WORLD" | "MEMORY"; selected: number; counts: number[];
  layout: NonNullable<XRScene["journeyLayout"]>; asOf: number | null; onTimeChange: (at: number | null) => void;
  onSelect: (index: number) => void; onMove: (index: number, position: RoomPoint) => void };
type Gesture = { pointer: number; start: { x: number; y: number }; camera: JourneyCamera;
  kind: "orbit" | "pan" | "move"; index?: number; origin?: RoomPoint; anchor: RoomPoint | null; moved: boolean };

export function XRJourneyMap({ episodes, mode, selected, counts, layout, asOf, onTimeChange, onSelect, onMove }: Props) {
  const [surface, setSurface] = useState<"globe" | "room">("globe");
  const globe = surface === "globe" && mode === "WORLD";
  const [globeCamera, setGlobeCamera] = useState<GlobeCamera>(GLOBE_CAMERA);
  const [camera, setCamera] = useState<JourneyCamera>(INITIAL_CAMERA);
  const [tool, setTool] = useState<"orbit" | "pan" | "move">("orbit");
  const [preview, setPreview] = useState<{ index: number; position: RoomPoint } | null>(null);
  const [dragging, setDragging] = useState<Gesture["kind"] | null>(null);
  const [notice, setNotice] = useState("");
  const [geography, setGeography] = useState(true), [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const svg = useRef<SVGSVGElement>(null), container = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null), draft = useRef<typeof preview>(null);
  const id = useId().replace(/:/g, "");
  const labels = useMemo(() => episodes.map(episode => episodeIdentifiers(episode).option), [episodes]);
  const position = (index: number): RoomPoint => preview?.index === index ? preview.position : mode === "MEMORY" ? episodes[index].memoryPosition! : episodes[index].worldPosition!.position;
  const activeTool = mode === "WORLD" && tool === "move" ? "orbit" : tool;
  const points = episodes.map((_, index) => projectRoom(position(index), camera));
  const current = points[selected];
  const time = journeyAtTime(episodes, asOf);
  const from = Date.parse(layout.from), until = Date.parse(layout.toExclusive) - 1;
  const formatDate = (at: number) => new Intl.DateTimeFormat("en-GB", { timeZone: layout.timeZone, dateStyle: "medium", timeStyle: "short" }).format(at);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = Math.min(until, (asOf ?? from) + 86400000);
      onTimeChange(next); if (next === until) setPlaying(false);
    }, 800);
    return () => clearInterval(timer);
  }, [playing, asOf, from, until, onTimeChange]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gesture.current) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? VIEW.height : 1);
      setCamera(previous => zoomCamera(previous, delta));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [globe]);

  function screen(event: ReactPointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix?.inverse());
    return { x: p.x, y: p.y };
  }
  function hit(p: { x: number; y: number }) {
    // Selected stop wins ties, so repeated places remain individually movable via the dropdown.
    const selectedPoint = points[selected];
    if (time.visible[selected] && selectedPoint.depth > .1 && Math.hypot(selectedPoint.x - p.x, selectedPoint.y - p.y) < 13) return selected;
    return points.map((point, index) => ({ index, distance: Math.hypot(point.x - p.x, point.y - p.y), depth: point.depth }))
      .filter(item => time.visible[item.index] && item.depth > .1 && item.distance < 13)
      .sort((a, b) => a.distance - b.distance || Number(b.index === selected) - Number(a.index === selected))[0]?.index;
  }
  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if (gesture.current || (event.button !== 0 && event.button !== 2)) return;
    setPlaying(false);
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    const start = screen(event), index = hit(start);
    const kind = event.shiftKey || event.button === 2 ? "pan" : activeTool === "move" && index === undefined ? "orbit" : activeTool;
    if (index !== undefined) onSelect(index);
    gesture.current = { pointer: event.pointerId, start, camera, kind, index,
      origin: index === undefined ? undefined : position(index), anchor: unprojectRoom(start, camera), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId); setDragging(kind);
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId) return;
    const p = screen(event), dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (Math.hypot(dx, dy) < 4 && !g.moved) return;
    g.moved = true;
    if (g.kind === "orbit") setCamera({ ...g.camera, yaw: g.camera.yaw - dx * .007,
      elevation: clamp(g.camera.elevation + dy * .005, .35, Math.PI / 2) });
    else {
      const target = unprojectRoom(p, g.camera);
      if (!target || !g.anchor) return;
      if (g.kind === "pan") setCamera({ ...g.camera, target: {
        x: clamp(g.camera.target.x + g.anchor.x - target.x, -40, 40),
        z: clamp(g.camera.target.z + g.anchor.z - target.z, -40, 40) } });
      else if (g.index !== undefined && g.origin) {
        draft.current = { index: g.index, position: { x: clamp(g.origin.x + target.x - g.anchor.x, -20, 20), z: clamp(g.origin.z + target.z - g.anchor.z, -20, 20) } };
        setPreview(draft.current);
      }
    }
  }
  function finish(commit: boolean) {
    const g = gesture.current;
    if (commit && g?.moved && draft.current && mode === "MEMORY") onMove(draft.current.index, draft.current.position);
    gesture.current = null; draft.current = null; setPreview(null); setDragging(null);
  }
  const path = (positions: RoomPoint[]) => positions.map(p => projectRoom(p, camera)).map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const floor = [{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }];
  const baseline = projectRoom(episodes[selected].worldPosition!.position, camera);
  return <div ref={container} className={styles.journeyMap}>
    <div className={styles.mapToolbar} aria-label="Map navigation">
      <div className={styles.actions}>
        <button aria-pressed={globe} disabled={mode === "MEMORY"} onClick={() => setSurface("globe")}>Globe</button>
        <button aria-pressed={!globe} onClick={() => setSurface("room")}>Room</button>
        {globe ? <>
          <button onClick={() => setGlobeCamera(GLOBE_CAMERA)}>Whole globe</button>
          <button onClick={() => setGlobeCamera({ latitude: 50, longitude: 10, zoom: 3.2 })}>Europe</button>
          <button onClick={() => { const point = episodeGeography(episodes[selected]); if (point) setGlobeCamera({ ...point, zoom: 12 }); }}>Focus episode</button>
          <button aria-label="Zoom in" onClick={() => setGlobeCamera(c => globeZoom(c, -160))}>＋</button>
          <button aria-label="Zoom out" onClick={() => setGlobeCamera(c => globeZoom(c, 160))}>−</button>
        </> : <>
          <button aria-pressed={activeTool === "orbit"} onClick={() => setTool("orbit")}>Orbit</button>
          <button aria-pressed={activeTool === "pan"} onClick={() => setTool("pan")}>Pan</button>
          {mode === "MEMORY" && <button aria-pressed={activeTool === "move"} onClick={() => setTool("move")}>Move episode</button>}
          <button onClick={() => setCamera(c => ({ ...c, target: { ...position(selected) }, distance: 8 }))}>Focus episode</button>
          <button onClick={() => setCamera(INITIAL_CAMERA)}>Reset view</button>
          <button onClick={() => setCamera(c => ({ ...c, yaw: 0, elevation: Math.PI / 2 }))}>Top view</button>
          <button aria-label="Zoom in" onClick={() => setCamera(c => zoomCamera(c, -160))}>＋</button>
          <button aria-label="Zoom out" onClick={() => setCamera(c => zoomCamera(c, 160))}>−</button>
        </>}
        <button aria-pressed={geography} onClick={() => setGeography(value => !value)}>{globe ? "Map labels" : "Geographic basemap"}</button>
        <button onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen().catch(() => setNotice("Fullscreen is unavailable here. The map controls still work inline.")); }}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
      </div>
      <p id={`${id}-help`}>{globe ? "Drag to rotate the Earth. Scroll to zoom from the whole globe to a place. Click a recorded stop to select it. Arrow keys rotate; + / − zoom; Home shows the whole globe." : `Drag to ${activeTool === "move" ? "move a stop on the room floor" : activeTool}. Scroll to zoom. Shift-drag to pan. Arrow keys orbit; + / − zoom; Home resets. Escape cancels a drag.`}</p>
      <small>{globe ? "Globe · recorded latitude / longitude · worldwide geography" : `Room · ${mode === "WORLD" ? "Geography locked" : "Author placement"}`}</small>
      {notice && <p role="status">{notice}</p>}
      <div className={styles.timeExplorer} aria-label="Journey through time">
        <div className={styles.actions}>
          <button aria-pressed={playing} onClick={() => { if (!playing && (asOf === null || asOf >= until)) onTimeChange(from); setPlaying(value => !value); }}>{playing ? "Pause journey" : "Play journey"}</button>
          <button aria-pressed={asOf === null} onClick={() => { setPlaying(false); onTimeChange(null); }}>Show full journey</button>
          <button disabled={selected === 0} onClick={() => { setPlaying(false); onTimeChange(Date.parse(episodes[selected - 1].start)); }}>Earlier stop</button>
          <button disabled={selected === episodes.length - 1} onClick={() => { setPlaying(false); onTimeChange(Date.parse(episodes[selected + 1].start)); }}>Later stop</button>
        </div>
        <label>Journey date · {asOf === null ? "all available stops" : formatDate(asOf)}
          <input type="range" min={from} max={until} step={60000} value={asOf ?? until} aria-label="Journey date" aria-valuetext={asOf === null ? "Full journey" : formatDate(asOf)} onChange={event => { setPlaying(false); onTimeChange(Number(event.target.value)); }}/>
        </label>
        <p aria-live="polite">{time.count} of {episodes.length} stops revealed{asOf !== null ? ` · ${time.activeCount ? `${time.activeCount} source-supported interior interval(s) cover this instant` : "No recorded stop covers this instant — location unknown"}` : ""}.</p>
        <small>{formatDate(from)} → {formatDate(until)} · {layout.timeZone}. Playback advances one day per step. Use the dropdown for individual visits. Gold marks Timeline intervals or conservative Author stay interiors; approximate boundaries and transit envelopes never claim continuous presence. The trail shows earlier observations or possible-date envelopes. Listening fields summarise full episode windows.</small>
      </div>
    </div>
    {globe ? <XRJourneyGlobe episodes={episodes} counts={counts} visible={time.visible} active={time.active} selected={selected} camera={globeCamera} onCamera={setGlobeCamera} onSelect={onSelect} onInteract={() => setPlaying(false)} geography={geography}/> : <>
    <svg ref={svg} className={styles.interactiveMap} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} tabIndex={0}
      role="img" aria-label={`${mode} interactive 3D journey map, ${episodes.length} stops`} aria-describedby={`${id}-help`}
      style={{ cursor: dragging ? "grabbing" : activeTool === "move" ? "crosshair" : "grab" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={event => { finish(true); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)} onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key === "Escape") { finish(false); return; }
        if (gesture.current) return;
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(event.key)) event.preventDefault();
        if (event.key === "Home") setCamera(INITIAL_CAMERA);
        else if (["+", "=", "-"].includes(event.key)) setCamera(c => zoomCamera(c, event.key === "-" ? 120 : -120));
        else if (event.key.startsWith("Arrow")) setCamera(c => ({ ...c, yaw: c.yaw + (event.key === "ArrowLeft" ? -.12 : event.key === "ArrowRight" ? .12 : 0),
          elevation: clamp(c.elevation + (event.key === "ArrowUp" ? .1 : event.key === "ArrowDown" ? -.1 : 0), .35, Math.PI / 2) }));
      }}>
      <defs>
        <radialGradient id={`${id}-field`}><stop offset="0" stopColor="#e9b987" stopOpacity=".4"/><stop offset="1" stopColor="#e9b987" stopOpacity="0"/></radialGradient>
        <radialGradient id={`${id}-orb`} cx="30%" cy="25%"><stop offset="0" stopColor="#fff" stopOpacity=".8"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
        <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#c7b9ed"/></marker>
      </defs>
      {/* Omit geometry crossing the camera near plane instead of projecting inverted shapes. */}
      {floor.every(p => projectRoom(p, camera).depth > .1) && <path d={`${path(floor)} Z`} fill="#142329" stroke="#718b8844"/>}
      {geography && <XRGeographyLayer projection={layout.projection} camera={camera}/>}
      {Array.from({ length: 11 }, (_, i) => i * 4 - 20).flatMap(n => [[{ x: n, z: -20 }, { x: n, z: 20 }], [{ x: -20, z: n }, { x: 20, z: n }]]).map((line, i) => {
        const segment = projectSegment(line[0], line[1], camera); return segment && <line key={i} x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke="#80958a" strokeOpacity=".15" strokeWidth="1"/>; })}
      {episodes.slice(1).map((episode, i) => { const segment = projectSegment(position(i), position(i + 1), camera), highlight = i === selected || i + 1 === selected; return time.visible[i + 1] && segment &&
        <line key={episode.id} x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={highlight ? "#c7b9ed" : "#a2b6bb"} strokeDasharray="4 3" strokeOpacity={highlight ? .85 : .25} strokeWidth={highlight ? 2 : 1} markerEnd={highlight ? `url(#${id}-arrow)` : undefined}/>; })}
      {points.map((p, index) => ({ p, index })).filter(({ p, index }) => p.depth > .1 && time.visible[index]).sort((a, b) => b.p.depth - a.p.depth).map(({ p, index }) => {
        const count = counts[index], r = clamp(p.scale * (index === selected ? .28 : .16), 3, 15);
        return <g key={episodes[index].id} opacity={index === selected ? 1 : .8}><title>{index + 1} · {labels[index]}</title>
          {count > 0 && <circle cx={p.x} cy={p.y} r={Math.min(150, (.35 + Math.min(1.2, Math.log1p(count) * .18)) * p.scale)} fill={`url(#${id}-field)`}/>}
          <circle cx={p.x} cy={p.y} r={r} fill={time.active[index] ? "#ffd384" : episodes[index].provenance.nodes[0]?.type === "author" ? "#c7b9ed" : "#bcffab"}/>
          <circle cx={p.x} cy={p.y} r={r} fill={`url(#${id}-orb)`}/>
        </g>;
      })}
      {mode === "MEMORY" && time.visible[selected] && baseline.depth > .1 && current.depth > .1 && <line x1={baseline.x} y1={baseline.y} x2={current.x} y2={current.y} stroke="#edb987" strokeWidth="2" strokeDasharray="5 5"/>}
      {current.depth > .1 && (asOf === null || time.active[selected]) && <g pointerEvents="none"><circle cx={current.x} cy={current.y} r="12" fill="none" stroke="white" strokeWidth="1.5"/><text x={current.x + 16} y={current.y - 14} fontSize="14" fill="white" paintOrder="stroke" stroke="#101b20" strokeWidth="4">{selected + 1}</text></g>}
      {(() => { const north = projectRoom({ x: 0, z: -20 }, camera); return north.depth > .1 && <text x={north.x} y={north.y - 12} textAnchor="middle" fill="#bcffab" fontSize="13">N · 40 × 40 room</text>; })()}
    </svg>
    </>}
    <p className={styles.mapCaption}>{globe ? "The globe uses source-supported geography; places on the far side are hidden. " : "View changes stay in this session. "}{mode === "MEMORY" ? "Move episode records one Author decision when released; save your review to keep it." : "Switch to MEMORY to reposition an episode."} {globe ? "Bristol’s Author-defined closing role is independent of its geographic position and chronological order." : "Stops remain on the geographic floor; height is not inferred."}</p>
    <p className={styles.mapCaption}><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Made with Natural Earth</a> · local country boundaries (1:110m) and city labels (1:50m). Generalised orientation, not street-level accuracy or visit evidence. {mode === "MEMORY" && "The basemap stays at WORLD coordinates while Author placements may move."} Dashed connections show time order, not travelled paths. {globe ? "Globe: latitude/longitude on a sphere, with an orthographic camera. No 40×40 clipping." : `Scale: 1 room unit ≈ ${(layout.projection.metresPerUnit / 1000).toFixed(1)} km at the projection origin.`}</p>
  </div>;
}
