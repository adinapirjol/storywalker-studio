'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_SCORE_BYTES, parseLinguisticScore, reviseCue, type LinguisticCue, type LinguisticScore } from '@/lib/xr/linguistic-score';
import css from './xr-linguistic-score.module.css';

export function scoreTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

type Props = {
  score: LinguisticScore | null;
  matched: boolean;
  index: number;
  position: number;
  playing: boolean;
  follow: boolean;
  preview: boolean;
  onScore: (score: LinguisticScore | null) => void;
  onSelect: (index: number) => void;
  onFollow: (follow: boolean) => void;
  onPreview: (preview: boolean) => void;
};

/** Selected text is held only in this mounted instrument. No source lookup or storage. */
export function XRLinguisticScore(props: Props) {
  const { score, matched, index, position, playing, follow, preview } = props;
  const [notice, setNotice] = useState('Optional: choose a private scene score to connect words, sound and space.');
  const selection = useRef(0);
  const downloadUrl = useRef<string | null>(null);
  useEffect(() => () => {
    selection.current++;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
  }, []);

  async function load(file?: File) {
    if (!file) return;
    const ticket = ++selection.current;
    try {
      if (file.size > MAX_SCORE_BYTES) throw new Error('Too large.');
      const next = parseLinguisticScore(await file.text());
      if (ticket !== selection.current) return;
      props.onScore(next);
      setNotice('Score opened in this tab. Readings remain proposals until you decide.');
    } catch {
      if (ticket === selection.current) setNotice('Could not open that score. Choose a valid private scene JSON under 128 KB; your current score is unchanged.');
    }
  }
  function edit(patch: Parameters<typeof reviseCue>[2]) {
    if (!score) return;
    try {
      props.onScore(reviseCue(score, score.cues[index].id, patch));
      setNotice('Revision held in this tab. Keep a local copy if you want to return to it.');
    } catch {
      setNotice('Change not applied. Keep times in order within this clip; the first cue starts at zero. History holds up to 128 changes.');
    }
  }
  function keep() {
    if (!score) return;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    const url = URL.createObjectURL(new Blob([JSON.stringify(score, null, 2)], { type: 'application/json' }));
    downloadUrl.current = url;
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'listening-again-scene.private.json'; anchor.click();
    setNotice('Private local copy requested. It includes your words and decisions, is not encrypted, and was not sent to the Vault.');
  }
  const cue = score?.cues[index];
  return <section className={css.score} aria-label="Words, sound and space">
    <div className={css.heading}><div><p>03 / WORDS, SOUND + SPACE</p><h3>One scene. Your reading.</h3></div>
      <label>Choose private scene score<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void load(file); }} /></label>
    </div>
    {score && cue && <>
      <p className={css.title}>{score.title}</p>
      <p>{matched ? 'Matching audio verified by file fingerprint.' : 'Choose the matching WAV before applying this scene. A title or duration alone cannot identify its audio.'} Source {scoreTime(score.source.offsetSeconds)}–{scoreTime(score.source.offsetSeconds + score.source.durationSeconds)}.</p>
      <p>{score.notes}</p>
      <div className={css.switches}>
        <label><input type="checkbox" checked={follow} disabled={!matched} onChange={event => props.onFollow(event.target.checked)} /> Follow cue times {score.cues.some(item => item.timing === 'proposed') ? '(includes proposed timings)' : '(Author-adjusted)'}</label>
        <label><input type="checkbox" checked={preview} disabled={!matched} onChange={event => props.onPreview(event.target.checked)} /> Preview unresolved readings and effects</label>
      </div>
      <p>Follow cue times also synchronizes any word, beat or drop accents. Manual selection holds a form without triggering timed accents. Proposed boundaries are not word-level transcription. Refusing a reading removes its scene effects; the music continues.</p>
      <div className={css.cues} role="group" aria-label="Scene markers">
        {score.cues.map((item, itemIndex) => <button key={item.id} aria-pressed={itemIndex === index} onClick={() => { props.onFollow(false); props.onSelect(itemIndex); }}>
          <span>{scoreTime(score.source.offsetSeconds + item.startSeconds)} · {item.timing === 'proposed' ? 'approx.' : 'marked'}</span>{item.title}<small>{item.accent ? `${item.accent.kind} · ${item.accent.reaction} · ` : ''}{item.decision}</small>
        </button>)}
      </div>
      <div className={css.reading} key={cue.id}>
        <p className={css.label}>AUTHOR-SUPPLIED WORDS · NOT FORCED ALIGNED</p>
        <blockquote>{cue.excerpt}</blockquote>
        {cue.note && <p className={css.markerNote}>{cue.note}</p>}
        <p className={css.label}>EDITOR PROPOSAL · {cue.decision.toUpperCase()}</p>
        <ReadingEditor key={`${cue.id}:${cue.reading}:${cue.formation}:${cue.openness}:${cue.echo}:${JSON.stringify(cue.accent)}`} cue={cue} onFocus={() => props.onFollow(false)} onRevise={revision => edit({ ...revision, decision: 'revised' })} />
        <p>Treatment proposal: {cue.formation}, tone opening {Math.round(cue.openness * 100)}%, echo suggestion {Math.round(cue.echo * 100)}%. {cue.decision === 'refused' ? 'Withheld.' : cue.decision === 'unresolved' && !preview ? 'Off until previewed or accepted.' : 'Enabled when the matching audio is selected.'} Phrase mode keeps tone open and echoes subtle; it adds no backing track.</p>
        <div className={css.actions}>
          <button disabled={!matched} onClick={() => edit({ decision: 'accepted' })}>Accept reading</button>
          <button onClick={() => edit({ decision: 'refused' })}>Refuse reading · keep music</button>
          <button onClick={() => edit({ decision: 'unresolved' })}>Leave unresolved</button>
        </div>
        <div className={css.actions}>
          <label>Start in selected clip (seconds)<input aria-label="Phrase start in clip" key={cue.startSeconds} type="number" step="0.1" min="0" max={score.source.durationSeconds} defaultValue={cue.startSeconds} disabled={index === 0} onBlur={event => {
            const startSeconds = Number(event.target.value);
            if (event.target.value.trim() && startSeconds !== cue.startSeconds) edit({ startSeconds, timing: 'author-adjusted' });
          }} /></label>
          <button disabled={!matched || !playing || index === 0} onClick={() => edit({ startSeconds: Math.round(position * 10) / 10, timing: 'author-adjusted' })}>Mark phrase start now</button>
        </div>
      </div>
      <details><summary>Original Author transcript and dated revisions ({score.history.length})</summary><p>{score.authorTranscript}</p><ol>{score.history.map((change, historyIndex) => <li key={historyIndex}>{change.at} · {change.before.title}: {change.before.decision} / {change.before.reading} / start {change.before.startSeconds}s</li>)}</ol></details>
      <div className={css.actions}><button onClick={keep}>Keep revised score locally</button><button onClick={() => { selection.current++; props.onScore(null); setNotice('Score removed from this tab.'); }}>Remove scene score</button></div>
    </>}
    <p role="status">{notice}</p>
  </section>;
}

type ReadingRevision = Pick<LinguisticCue, 'reading' | 'formation' | 'openness' | 'echo' | 'accent'>;
function ReadingEditor({ cue, onFocus, onRevise }: { cue: LinguisticCue; onFocus: () => void; onRevise: (revision: ReadingRevision) => void }) {
  const [reading, setReading] = useState(cue.reading);
  const [formation, setFormation] = useState(cue.formation);
  const [openness, setOpenness] = useState(cue.openness);
  const [echo, setEcho] = useState(cue.echo);
  const [accent, setAccent] = useState(cue.accent ?? null);
  const changed = reading.trim() !== cue.reading || formation !== cue.formation || openness !== cue.openness || echo !== cue.echo || JSON.stringify(accent) !== JSON.stringify(cue.accent ?? null);
  return <div className={css.editor} onFocus={onFocus}><label>Your editable reading<textarea aria-label="Your editable reading" maxLength={1200} value={reading} onChange={event => setReading(event.target.value)} /></label>
    <div className={css.mapping}>
      <label>Spatial form<select aria-label="Spatial form" value={formation} onChange={event => setFormation(event.target.value as LinguisticCue['formation'])}><option value="gather">Gather</option><option value="carry">Carry</option><option value="open">Open</option><option value="orbit">Orbit</option></select></label>
      <label>Tone opening {Math.round(openness * 100)}%<input aria-label="Phrase tone opening" type="range" min="0" max="1" step="0.05" value={openness} onChange={event => setOpenness(Number(event.target.value))} /></label>
      <label>Echo suggestion {Math.round(echo * 100)}%<input aria-label="Phrase echo suggestion" type="range" min="0" max="1" step="0.05" value={echo} onChange={event => setEcho(Number(event.target.value))} /></label>
    </div>
    <div className={css.mapping}>
      <label>Timed visual accent<select aria-label="Timed visual accent" value={accent?.reaction ?? 'none'} onChange={event => setAccent(event.target.value === 'none' ? null : { kind: accent?.kind ?? 'word', reaction: event.target.value as NonNullable<LinguisticCue['accent']>['reaction'], durationSeconds: accent?.durationSeconds ?? 0.9, strength: accent?.strength ?? 0.75 })}>
        <option value="none">None</option><option value="gather">Gather</option><option value="ripple">Ripple</option><option value="compress">Compress</option><option value="burst">Burst</option><option value="release">Release</option><option value="halo">Halo</option>
      </select></label>
      {accent && <>
        <label>Marker kind<select aria-label="Marker kind" value={accent.kind} onChange={event => setAccent({ ...accent, kind: event.target.value as NonNullable<LinguisticCue['accent']>['kind'] })}><option value="word">Word</option><option value="beat">Beat</option><option value="drop">Drop</option></select></label>
        <label>Accent length {accent.durationSeconds.toFixed(2)}s<input aria-label="Accent length" type="range" min="0.25" max="1.5" step="0.05" value={accent.durationSeconds} onChange={event => setAccent({ ...accent, durationSeconds: Number(event.target.value) })} /></label>
        <label>Accent strength {Math.round(accent.strength * 100)}%<input aria-label="Accent strength" type="range" min="0" max="1" step="0.05" value={accent.strength} onChange={event => setAccent({ ...accent, strength: Number(event.target.value) })} /></label>
      </>}
    </div>
    <p>Accents are visual pulses at your markers. Your hands keep control of tone and echo. Reduced-motion mode suppresses these pulses.</p>
    <button disabled={!reading.trim() || !changed} onClick={() => onRevise({ reading: reading.trim(), formation, openness, echo, accent })}>Use my revision</button></div>;
}
