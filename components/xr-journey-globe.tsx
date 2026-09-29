"use client";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { BasemapData } from "@/lib/journey-basemap";
import type { JourneyEpisode } from "@/lib/journey-episode";
import { createGlobeRenderer } from "@/lib/globe-renderer";
import { episodeGeography, globeTurn, globeZoom, projectSphere, sphereArc, spherePoint, visibleArcPath, GLOBE_CAMERA, type GlobeCamera } from "@/lib/journey-globe";
import styles from "./xr-lab.module.css";

type Props = { episodes: JourneyEpisode[]; counts: number[]; visible: boolean[]; active: boolean[]; selected: number;
  camera: GlobeCamera; onCamera: (camera: GlobeCamera | ((previous: GlobeCamera) => GlobeCamera)) => void;
  onSelect: (index: number) => void; onInteract: () => void; geography: boolean };
export function XRJourneyGlobe({ episodes, counts, visible, active, selected, camera, onCamera, onSelect, onInteract, geography }: Props) {
  const [data, setData] = useState<BasemapData | null>(null), [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null), svg = useRef<SVGSVGElement>(null);
  const renderer = useRef<ReturnType<typeof createGlobeRenderer> | null>(null), latestCamera = useRef(camera);
  const drag = useRef<{ pointer: number; start: { x: number; y: number }; camera: GlobeCamera; moved: boolean } | null>(null);
  const vertices = useMemo(() => episodes.map(episode => { const geo = episodeGeography(episode); return geo ? spherePoint(geo) : null; }), [episodes]);
  const arcs = useMemo(() => vertices.slice(1).map((to, i) => to && vertices[i] ? sphereArc(vertices[i]!, to) : []), [vertices]);
  const points = vertices.map(point => point ? projectSphere(point, camera) : null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/maps/natural-earth.json", { signal: abort.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setData).catch(() => { if (!abort.signal.aborted) setError("The local globe map could not load. Room view remains available."); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!data || !canvas.current) return;
    const element = canvas.current;
    const lost = (event: Event) => { event.preventDefault(); setError("Globe graphics were interrupted. Switch to Room, then Globe to retry."); };
    element.addEventListener("webglcontextlost", lost);
    try { renderer.current = createGlobeRenderer(element, data); renderer.current.draw(latestCamera.current); }
    catch { setError("3D graphics are unavailable in this browser. Room view remains available."); }
    return () => { element.removeEventListener("webglcontextlost", lost); renderer.current?.dispose(); renderer.current = null; };
  }, [data]);
  useEffect(() => { latestCamera.current = camera; renderer.current?.draw(camera); }, [camera]);
  useEffect(() => {
    const element = svg.current; if (!element) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); if (drag.current) return; onInteract();
      onCamera(c => globeZoom(c, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1))); };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [onCamera, onInteract]);
  function screen(event: PointerEvent<SVGSVGElement>) {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(event.currentTarget.getScreenCTM()!.inverse()); return { x: p.x, y: p.y };
  }
  function pick(p: { x: number; y: number }) {
    const candidates = points.flatMap((point, index) => point && point.depth > 0 && visible[index] ? [{ index, distance: Math.hypot(point.x - p.x, point.y - p.y) }] : [])
      .filter(item => item.distance <= 12).sort((a, b) => a.distance - b.distance || Number(b.index === selected) - Number(a.index === selected));
    if (candidates.length) onSelect(candidates[0].index);
  }
  const used: { x: number; y: number; width: number }[] = [];
  const cities = data?.cities.map(city => ({ name: city.name, coordinates: city.coordinates, country: false, rank: city.rank })).sort((a, b) => a.rank - b.rank) ?? [];
  const countries = data?.countries.map(country => ({ name: country.name, coordinates: country.label, country: true, rank: 0 })) ?? [];
  const labels = (camera.zoom >= 2 ? [...cities, ...countries] : countries).flatMap(label => {
    const p = projectSphere(spherePoint({ longitude: label.coordinates[0], latitude: label.coordinates[1] }), camera), width = label.name.length * 6;
    if (p.depth < .18 || p.x < 16 || p.x + width > 780 || p.y < 24 || p.y > 580 || used.some(a => Math.abs(a.y - p.y) < 19 && p.x < a.x + a.width + 8 && p.x + width + 8 > a.x)) return [];
    used.push({ ...p, width }); return [{ ...label, ...p }];
  });
  return <div className={styles.globeStage}>
    <canvas ref={canvas} width={1600} height={1200} aria-hidden="true"/>
    <svg ref={svg} viewBox="0 0 800 600" className={styles.globeOverlay} role="img" aria-label={`Interactive globe with ${visible.filter(Boolean).length} recorded stops; drag to rotate, scroll to zoom`} tabIndex={0}
      onPointerDown={event => { if (drag.current || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); onInteract();
        drag.current = { pointer: event.pointerId, start: screen(event), camera, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { const g = drag.current; if (!g || g.pointer !== event.pointerId) return; const p = screen(event), dx = p.x - g.start.x, dy = p.y - g.start.y;
        if (Math.hypot(dx, dy) > 3) g.moved = true; if (g.moved) onCamera(globeTurn(g.camera, dx, dy)); }}
      onPointerUp={event => { const g = drag.current; if (g?.pointer !== event.pointerId) return; if (!g.moved) pick(screen(event)); drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(event.key)) return;
        event.preventDefault(); onInteract();
        if (event.key === "Home") onCamera(GLOBE_CAMERA);
        else if (["+", "=", "-"].includes(event.key)) onCamera(c => globeZoom(c, event.key === "-" ? 160 : -160));
        else onCamera(c => globeTurn(c, event.key === "ArrowLeft" ? 40 : event.key === "ArrowRight" ? -40 : 0, event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0));
      }}>
      {geography && labels.map((label, index) => <text key={`${label.name}-${index}`} x={label.x} y={label.y} fontSize={label.country ? 11 : 12} fill={label.country ? "#d3dfc5" : "#edf4e8"} paintOrder="stroke" stroke="#153129" strokeWidth="3" pointerEvents="none">{label.name}</text>)}
      {arcs.map((arc, index) => visible[index + 1] && <path key={index} d={visibleArcPath(arc, camera)} fill="none" stroke={index === selected || index + 1 === selected ? "#e5cdff" : "#bcdfcd"} strokeWidth={index === selected || index + 1 === selected ? 2 : 1} strokeOpacity=".6" strokeDasharray="4 3" pointerEvents="none"/>)}
      {points.map((p, index) => p && p.depth > .005 && visible[index] && <g key={episodes[index].id}>
        <title>{index + 1} · {episodes[index].start} · {episodes[index].label}</title>
        {counts[index] > 0 && <circle cx={p.x} cy={p.y} r={6 + Math.min(15, Math.log1p(counts[index]) * 2)} fill="#edba83" opacity=".13"/>}
        <circle cx={p.x} cy={p.y} r={selected === index ? 5 : 3} fill={active[index] ? "#ffd384" : episodes[index].provenance.nodes[0]?.type === "author" ? "#c7b9ed" : "#bcffab"}/>
        {selected === index && <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="white"/>}
      </g>)}
      {(!data || error) && <text x="25" y="35" fill="#e9ece4" fontSize="13">{error || "Loading local globe…"}</text>}
      <text x="20" y="580" fill="#c0d2cf" fontSize="12" pointerEvents="none">WORLD · {camera.zoom.toFixed(1)}× · {camera.latitude.toFixed(1)}° latitude / {camera.longitude.toFixed(1)}° longitude</text>
    </svg>
  </div>;
}
