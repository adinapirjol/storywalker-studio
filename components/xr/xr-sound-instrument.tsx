'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { INITIAL_SHAPE, followLevel, shapeFromHands, unit, type SoundShape } from '@/lib/xr/sound-shape';
import { SoundShapeAudio } from '@/lib/xr/sound-shape-audio';
import { SoundShapeMicrophone } from '@/lib/xr/sound-shape-microphone';
import { startShapeHands } from '@/lib/xr/sound-shape-hands';
import { drawSoundRibbon } from '@/lib/xr/sound-shape-renderer';
import { cueAt, matchesScoreAudio, sceneFrame, type LinguisticScore } from '@/lib/xr/linguistic-score';
import { XRLinguisticScore, scoreTime } from './xr-linguistic-score';
import { XRPhraseTimeline } from './xr-phrase-timeline';
import { XRGeneratedMusicLibrary } from './xr-generated-music-library';
import { XR_GENERATED_MUSIC_SAMPLES } from './xr-generated-music-samples';
import { visualAccentAt } from '@/lib/xr/sound-accent';
import css from './xr-sound-instrument.module.css';

function assetUrlForSample(sampleId: string) {
  return '/api/xr/music-library?sample=' + encodeURIComponent(sampleId) + '&asset=audio';
}

function RotaryControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  function keyChange(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const amount = event.key === 'PageUp' ? 0.1 : event.key === 'PageDown' ? -0.1 : ['ArrowUp', 'ArrowRight'].includes(event.key) ? 0.02 : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -0.02 : 0;
    if (!amount) return;
    event.preventDefault();
    onChange(unit(value + amount));
  }
  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    drag.current = { y: event.clientY, value };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current || event.buttons !== 1) return;
    onChange(unit(drag.current.value + (drag.current.y - event.clientY) * 0.006));
  }
  const style = { '--dial-turn': `${-135 + value * 270}deg` } as CSSProperties;
  return <div className={css.dialControl}>
    <span>{label}</span>
    <button type="button" className={css.dial} style={style} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-valuetext={`${Math.round(value * 100)} percent`} onKeyDown={keyChange} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <span className={css.dialNeedle} />
    </button>
    <output>{Math.round(value * 100)}%</output>
  </div>;
}

export function XRSoundInstrument() {
  const [audio] = useState(() => new SoundShapeAudio());
  const [microphone] = useState(() => new SoundShapeMicrophone());
  const [shape, setShape] = useState<SoundShape>(INITIAL_SHAPE);
  const [volume, setVolume] = useState(0.3);
  const [influence, setInfluence] = useState(0.5);
  const [duration, setDuration] = useState<number | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [score, setScore] = useState<LinguisticScore | null>(null);
  const [selectedCue, setSelectedCue] = useState(0);
  const [follow, setFollow] = useState(false);
  const [previewReadings, setPreviewReadings] = useState(false);
  const [position, setPosition] = useState(0);
  const [bpm, setBpm] = useState(148);
  const [loading, setLoading] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [playingLayers, setPlayingLayers] = useState<Set<string>>(() => new Set());
  const [layerVolumes, setLayerVolumes] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [handsOn, setHandsOn] = useState(false);
  const [micState, setMicState] = useState<'off' | 'asking' | 'on'>('off');
  const [message, setMessage] = useState('Choose a local WAV sketch or phrase to begin.');
  const [handMessage, setHandMessage] = useState('Camera off · sliders work too');
  const [level, setLevel] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null), preview = useRef<HTMLCanvasElement>(null);
  const shapeRef = useRef(shape), influenceRef = useRef(influence);
  const stopHands = useRef<() => void>(() => {});
  const layerAudio = useRef(new Map<string, HTMLAudioElement>());
  const libraryLoad = useRef<AbortController | null>(null);
  const playTurn = useRef(0), micTurn = useRef(0), fileTurn = useRef(0);
  const micTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const matched = score ? matchesScoreAudio(score, duration, fingerprint) : false;
  const cueIndex = score && follow && matched ? cueAt(score, position) : score ? Math.min(selectedCue, score.cues.length - 1) : 0;
  const cue = matched ? score?.cues[cueIndex] : undefined;
  const currentFrame = cue ? sceneFrame(cue, previewReadings) : null;
  const sceneRef = useRef(currentFrame);
  sceneRef.current = currentFrame;
  const accentPlayback = useRef({ score: matched ? score : null, follow, preview: previewReadings });
  accentPlayback.current = { score: matched ? score : null, follow, preview: previewReadings };

  function changeShape(next: SoundShape) {
    shapeRef.current = next;
    setShape(next);
  }
  function stopPlayback() {
    playTurn.current++;
    audio.stop(); setPlaying(false); setStarting(false); setPosition(0);
  }
  function stopLayers() {
    for (const player of layerAudio.current.values()) {
      player.pause();
      player.currentTime = 0;
    }
    setPlayingLayers(new Set());
  }
  async function toggleLayer(sampleId: string) {
    const player = layerAudio.current.get(sampleId);
    if (!player) return;
    if (!player.paused) {
      player.pause();
      player.currentTime = 0;
      setPlayingLayers(current => { const next = new Set(current); next.delete(sampleId); return next; });
      return;
    }
    player.loop = true;
    player.volume = unit(layerVolumes[sampleId] ?? 0.72) * 0.72;
    try {
      await player.play();
      if (!player.paused) setPlayingLayers(current => new Set(current).add(sampleId));
    } catch {
      if (player.error) setMessage('That local layer is unavailable. Try a different track or load a WAV.');
    }
  }
  function stopInputs() {
    micTurn.current++; clearTimeout(micTimer.current);
    microphone.stop(); stopHands.current(); stopHands.current = () => {};
    setMicState('off'); setHandsOn(false); setLevel(0);
    setHandMessage('Camera off · last hand shape held');
  }
  function stopAll() {
    stopPlayback(); stopLayers(); stopInputs();
    setMessage('Stopped · sound, camera and microphone are off.');
  }
  async function load(file?: File, sampleId = '') {
    if (!file) return;
    if (!sampleId) libraryLoad.current?.abort();
    setSelectedSampleId(sampleId);
    stopPlayback();
    const ticket = ++fileTurn.current;
    setLoading(true); setDuration(null); setFingerprint(null); setMessage('Opening your sketch in this tab…');
    try {
      const seconds = await audio.load(file);
      if (ticket !== fileTurn.current) return;
      setDuration(seconds);
      setFingerprint(audio.selectedFingerprint());
      setMessage(seconds ? 'Local sketch ready · press Play. Nothing uploaded or saved.' : 'Choose the sketch again.');
    } catch {
      if (ticket === fileTurn.current) setMessage('Could not open that file. Choose a mono/stereo WAV, 1–60 seconds, under 16 MB.');
    } finally { if (ticket === fileTurn.current) setLoading(false); }
  }
  async function loadGeneratedSample(sampleId: string) {
    libraryLoad.current?.abort();
    const controller = new AbortController();
    libraryLoad.current = controller;
    try {
      const response = await fetch(assetUrlForSample(sampleId), {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Local sample unavailable');
      const blob = await response.blob();
      if (blob.size > 16 * 1024 * 1024) throw new Error('Sample is too large');
      if (!controller.signal.aborted) await load(new File([blob], sampleId + '.wav', { type: 'audio/wav' }), sampleId);
    } catch {
      if (!controller.signal.aborted) setMessage('Could not load that local library WAV. Your current sketch remains selected.');
    } finally {
      if (libraryLoad.current === controller) libraryLoad.current = null;
    }
  }
  async function play() {
    const ticket = ++playTurn.current;
    setStarting(true);
    try {
      setPosition(0);
      const started = await audio.play(shapeRef.current, volume, {
        bpm, loop: !matched, preserveWords: matched,
        onEnded: () => {
          if (ticket !== playTurn.current) return;
          setPlaying(false); setPosition(duration ?? 0);
          setMessage('Scene finished · your words, cue decisions and revisions remain in this tab.');
        },
      });
      if (ticket !== playTurn.current) return;
      setPlaying(started);
      setMessage(started ? matched ? 'Playing one scene · original speed, open tone and subtle echoes. No extra backing layer.' : 'Playing · stretch opens the tone; folding adds beat-timed echoes.' : 'Choose the WAV sketch first.');
    } catch {
      if (ticket === playTurn.current) setMessage('Playback could not start. Your sketch is still selected; try Play again.');
    } finally { if (ticket === playTurn.current) setStarting(false); }
  }
  function toggleHands() {
    if (handsOn) {
      stopHands.current(); stopHands.current = () => {};
      setHandsOn(false); setHandMessage('Camera off · last hand shape held'); return;
    }
    if (!preview.current) return;
    setHandsOn(true); setHandMessage('Waiting for camera permission and local hand tracking…');
    stopHands.current = startShapeHands({
      preview: preview.current,
      onHands: hands => {
        const next = shapeFromHands(hands, shapeRef.current);
        if (!next) { setHandMessage('Bring one or two hands into view · last shape held'); return; }
        changeShape({
          stretch: shapeRef.current.stretch * 0.65 + next.stretch * 0.35,
          fold: shapeRef.current.fold * 0.65 + next.fold * 0.35,
        });
        setHandMessage(hands.length === 2 ? 'Two hands · move apart to stretch; curl fingers to fold' : 'One hand · open or curl fingers to fold; add a second hand to stretch');
      },
      onError: () => { setHandsOn(false); setHandMessage('Camera unavailable or permission declined · use the sliders'); },
    });
  }
  async function toggleMicrophone() {
    if (micState !== 'off') {
      micTurn.current++; clearTimeout(micTimer.current);
      microphone.stop(); setMicState('off'); setLevel(0); return;
    }
    const ticket = ++micTurn.current;
    setMicState('asking');
    setMessage('Waiting for microphone permission · use the toggle again to cancel.');
    micTimer.current = setTimeout(() => {
      if (ticket !== micTurn.current) return;
      micTurn.current++; microphone.stop(); setMicState('off');
      setMessage('Microphone request timed out. You can try the toggle again.');
    }, 30000);
    try {
      const active = await microphone.start(() => {
        micTurn.current++; clearTimeout(micTimer.current);
        setMicState('off'); setLevel(0); setMessage('Microphone disconnected · ambient influence off.');
      });
      if (ticket !== micTurn.current) return;
      clearTimeout(micTimer.current);
      setMicState(active ? 'on' : 'off');
      if (active) setMessage('Microphone on · nearby sound ripples the form. It is not played back or recorded.');
    } catch {
      if (ticket !== micTurn.current) return;
      clearTimeout(micTimer.current); setMicState('off');
      setMessage('Microphone unavailable or permission declined. Hands and playback still work.');
    }
  }

  useEffect(() => { audio.update(shape, volume, currentFrame); }, [audio, shape, volume, currentFrame]);
  useEffect(() => { influenceRef.current = influence; }, [influence]);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, lastMeter = 0, lastClock = 0, smoothed = 0;
    function draw(now: number) {
      const rect = element!.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
      if (element!.width !== width || element!.height !== height) { element!.width = width; element!.height = height; }
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      smoothed = followLevel(smoothed, microphone.level());
      const playback = accentPlayback.current;
      const accent = playback.score && playback.follow ? visualAccentAt(playback.score, audio.position(), playback.preview, audio.isPlaying()) : null;
      drawSoundRibbon(context!, rect.width, rect.height, shapeRef.current, smoothed * influenceRef.current, now / 1000, motion.matches, sceneRef.current, accent);
      if (now - lastMeter > 150) {
        setLevel(smoothed);
        lastMeter = now;
      }
      if (now - lastClock > 100) {
        if (audio.isPlaying()) setPosition(audio.position());
        lastClock = now;
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [audio, microphone]);
  useEffect(() => {
    const players = Array.from(layerAudio.current.values());
    const pause = () => {
      playTurn.current++; micTurn.current++; clearTimeout(micTimer.current);
      audio.stop(); stopLayers(); microphone.stop(); stopHands.current(); stopHands.current = () => {};
      setPlaying(false); setStarting(false); setHandsOn(false); setMicState('off'); setLevel(0);
      setHandMessage('Camera off · last hand shape held');
      setMessage('Paused while away · press Play or enable inputs to resume.');
    };
    const hidden = () => { if (document.hidden) pause(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') pause(); };
    window.addEventListener('blur', pause); window.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      fileTurn.current++; playTurn.current++; micTurn.current++;
      libraryLoad.current?.abort();
      for (const player of players) player.pause();
      clearTimeout(micTimer.current); stopHands.current(); audio.dispose(); microphone.stop();
      window.removeEventListener('blur', pause); window.removeEventListener('keydown', escape);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [audio, microphone]);

  return <section className={css.instrument} aria-label="Listening Again sound instrument">
    <header className={css.header}>
      <div><p className={css.eyebrow}>LISTENING AGAIN</p><h2>Shape the sound</h2></div>
      <div className={css.headerActions}><span className={css.tempo}>{bpm} <small>BPM</small></span></div>
    </header>
    <div className={css.visual}>
      <canvas ref={canvas} aria-label="A suspended sound ribbon. Stretch changes its width and tone; fold changes its curl and echoes; optional microphone level adds ripples." />
      <div className={css.sceneNote}><span>HANDS SHAPE · ROOM RIPPLES</span><p>{cue ? <>{cue.title}<br />{currentFrame ? `${cue.decision === 'unresolved' ? 'Preview' : 'Your choice'} · ${currentFrame.formation}` : playing ? 'Reading withheld · music continues' : 'Reading withheld · press Play'}</> : null}</p></div>
      <div className={css.sceneReadout} aria-hidden="true"><span>STRETCH {Math.round(shape.stretch * 100)}%</span><span>FOLD {Math.round(shape.fold * 100)}%</span><span>{micState === 'on' ? 'ROOM LISTENING' : 'ROOM OFF'}</span></div>
      {duration && <XRPhraseTimeline position={position} duration={duration} playing={playing} starting={starting} score={matched ? score : null} activeCue={cueIndex} onTogglePlayback={() => playing ? stopPlayback() : void play()} />}
    </div>
    <div className={css.desk}>
      <section className={css.trackColumn} aria-label="Track deck">
        <section className={css.generatedPicker} aria-label="Generated track deck">
          <div className={css.deckHeading}><div><span>TRACKS · 148 BPM SESSION</span><h3>Track deck</h3></div><span>{playingLayers.size} ON</span></div>
          <div className={css.generatedOptions}>
            {XR_GENERATED_MUSIC_SAMPLES.map((sample, index) => <div key={sample.id} className={playingLayers.has(sample.id) ? css.sampleStripPlaying : css.sampleStrip}>
              <span className={css.trackNumber}>{String(index + 1).padStart(2, '0')}</span>
              <button type="button" className={playingLayers.has(sample.id) ? css.layerStop : css.layerPlay} aria-label={(playingLayers.has(sample.id) ? 'Stop ' : 'Play ') + sample.title} onClick={() => void toggleLayer(sample.id)}>{playingLayers.has(sample.id) ? '■' : '▶'}</button>
              <span className={css.stripInfo}><strong>{sample.title}</strong><small>{sample.bpm} BPM · {sample.length}</small></span>
              <label className={css.trackGain}><span>GAIN</span><input aria-label={sample.title + ' layer volume'} type="range" min="0" max="1" step="0.01" value={layerVolumes[sample.id] ?? 0.72} onChange={event => {
                const next = unit(Number(event.target.value));
                setLayerVolumes(current => ({ ...current, [sample.id]: next }));
                const player = layerAudio.current.get(sample.id);
                if (player) player.volume = next * 0.72;
              }} /></label>
              <button type="button" className={selectedSampleId === sample.id ? css.loadedTrack : css.loadTrack} aria-label={selectedSampleId === sample.id ? `Loaded for shaping: ${sample.title}` : `Load ${sample.title} for shaping`} title={selectedSampleId === sample.id ? 'Currently shaped by the hands controls' : 'Select this track for hand shaping'} disabled={loading || starting} onClick={() => void loadGeneratedSample(sample.id)}>{selectedSampleId === sample.id ? 'Shaping' : 'Shape'}</button>
              <audio ref={element => { if (element) layerAudio.current.set(sample.id, element); else layerAudio.current.delete(sample.id); }} src={assetUrlForSample(sample.id)} preload="none" />
            </div>)}
          </div>
        </section>
        <details className={css.localFile}>
          <summary>Load a local WAV</summary>
          <label>Choose WAV<input type="file" accept=".wav,audio/wav,audio/x-wav" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void load(file); }} /></label>
          <p>Stays in this tab. Use audio you have permission to work with.</p>
        </details>
      </section>
      <section className={css.controlSurface} aria-label="Playback and shaping controls">
        <div className={css.transport}>
          <div className={css.actions}><button className={css.play} disabled={!duration || loading || starting} onClick={() => playing ? stopPlayback() : void play()}>{starting ? 'Starting…' : playing ? 'Stop' : 'Play'}</button><button onClick={stopAll}>Stop all</button><span className={css.position} aria-label="Playback position">{scoreTime(position)}{duration ? ` / ${scoreTime(duration)}` : ''}</span></div>
          <label className={css.slider}>Echo BPM <input aria-label="Echo grid BPM" type="number" min="60" max="200" value={bpm} disabled={playing || starting || matched} onChange={event => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) setBpm(Math.max(60, Math.min(200, value)));
          }} /></label>
          <label className={css.slider}>Volume <output>{Math.round(volume * 100)}%</output><input aria-label="Sketch volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(unit(Number(event.target.value)))} /></label>
          <p className={css.transportStatus} role="status">{loading ? 'Loading WAV…' : duration ? `${matched ? 'Scene' : selectedSampleId ? 'Generated loop' : 'Local loop'} ready` : 'Choose a track'}</p>
        </div>
        <div className={css.handControls}>
          <h3>Hands</h3>
          <button aria-pressed={handsOn} onClick={toggleHands}>{handsOn ? 'Camera on · turn off' : 'Enable camera'}</button>
          <canvas ref={preview} width={320} height={240} hidden={!handsOn} className={css.preview} aria-label="Mirrored local hand preview" />
          <p className={css.controlStatus} role="status">{handMessage}</p>
          <div className={css.knobRow}>
            <RotaryControl label="Tone" value={shape.stretch} onChange={value => changeShape({ ...shapeRef.current, stretch: value })} />
            <RotaryControl label="Echo" value={shape.fold} onChange={value => changeShape({ ...shapeRef.current, fold: value })} />
          </div>
        </div>
        <div className={css.roomControls}>
          <h3>Room</h3>
          <button role="switch" aria-label="Let nearby sound influence the visual form" aria-checked={micState !== 'off'} onClick={() => void toggleMicrophone()}>{micState === 'on' ? 'Mic on · turn off' : micState === 'asking' ? 'Cancel mic access' : 'Enable microphone'}</button>
          <p className={css.controlStatus}>Sound level adds visual ripples.</p>
          <RotaryControl label="Room" value={influence} onChange={setInfluence} />
          <label className={css.meter}>Input <meter aria-label="Nearby sound level" min={0} max={1} value={micState === 'on' ? level : 0} /></label>
          <details className={css.privacy}><summary>Privacy</summary><p>Camera and microphone are opt in and stay local. Nothing is recorded or saved; leaving stops both.</p></details>
        </div>
      </section>
    </div>
    <XRGeneratedMusicLibrary onLoadSample={loadGeneratedSample} />
    <XRLinguisticScore score={score} matched={matched} index={cueIndex} position={position} playing={playing} follow={follow} preview={previewReadings}
      onScore={next => {
        if (score?.source.sha256 !== next?.source.sha256 || !next) {
          stopPlayback(); setSelectedCue(0); setFollow(false); setPreviewReadings(false);
        }
        if (next) setBpm(next.gridBpm);
        setScore(next);
      }} onSelect={setSelectedCue} onFollow={next => { if (!next) setSelectedCue(cueIndex); setFollow(next); }} onPreview={setPreviewReadings} />
    <footer className={css.footer}><p role="status">{message}</p><p>Tabula-inspired prototype · musical choices do not accept an AI interpretation. No IOANA sample is bundled.</p></footer>
  </section>;
}
