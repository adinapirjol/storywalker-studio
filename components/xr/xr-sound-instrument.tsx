'use client';

import { useEffect, useRef, useState } from 'react';
import { INITIAL_SHAPE, followLevel, shapeFromHands, unit, type SoundShape } from '@/lib/xr/sound-shape';
import { SoundShapeAudio } from '@/lib/xr/sound-shape-audio';
import { SoundShapeMicrophone } from '@/lib/xr/sound-shape-microphone';
import { startShapeHands } from '@/lib/xr/sound-shape-hands';
import { drawSoundRibbon } from '@/lib/xr/sound-shape-renderer';
import css from './xr-sound-instrument.module.css';

export function XRSoundInstrument({ onLeave }: { onLeave: () => void }) {
  const [audio] = useState(() => new SoundShapeAudio());
  const [microphone] = useState(() => new SoundShapeMicrophone());
  const [shape, setShape] = useState<SoundShape>(INITIAL_SHAPE);
  const [volume, setVolume] = useState(0.3);
  const [influence, setInfluence] = useState(0.5);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [handsOn, setHandsOn] = useState(false);
  const [micState, setMicState] = useState<'off' | 'asking' | 'on'>('off');
  const [message, setMessage] = useState('Choose the 148 BPM WAV sketch to begin.');
  const [handMessage, setHandMessage] = useState('Camera off · sliders work too');
  const [level, setLevel] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null), preview = useRef<HTMLCanvasElement>(null);
  const shapeRef = useRef(shape), influenceRef = useRef(influence);
  const stopHands = useRef<() => void>(() => {});
  const playTurn = useRef(0), micTurn = useRef(0), fileTurn = useRef(0);
  const micTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function changeShape(next: SoundShape) {
    shapeRef.current = next;
    setShape(next);
  }
  function stopPlayback() {
    playTurn.current++;
    audio.stop(); setPlaying(false); setStarting(false);
  }
  function stopInputs() {
    micTurn.current++; clearTimeout(micTimer.current);
    microphone.stop(); stopHands.current(); stopHands.current = () => {};
    setMicState('off'); setHandsOn(false); setLevel(0);
    setHandMessage('Camera off · last hand shape held');
  }
  function stopAll() {
    stopPlayback(); stopInputs();
    setMessage('Stopped · sound, camera and microphone are off.');
  }
  async function load(file?: File) {
    if (!file) return;
    stopPlayback();
    const ticket = ++fileTurn.current;
    setLoading(true); setDuration(null); setMessage('Opening your sketch in this tab…');
    try {
      const seconds = await audio.load(file);
      if (ticket !== fileTurn.current) return;
      setDuration(seconds);
      setMessage(seconds ? 'Local sketch ready · press Play. Nothing uploaded or saved.' : 'Choose the sketch again.');
    } catch {
      if (ticket === fileTurn.current) setMessage('Could not open that file. Choose a mono/stereo WAV, 1–60 seconds, under 16 MB.');
    } finally { if (ticket === fileTurn.current) setLoading(false); }
  }
  async function play() {
    const ticket = ++playTurn.current;
    setStarting(true);
    try {
      const started = await audio.play(shapeRef.current, volume);
      if (ticket !== playTurn.current) return;
      setPlaying(started);
      setMessage(started ? 'Playing · stretch opens the tone; folding adds beat-timed echoes.' : 'Choose the WAV sketch first.');
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

  useEffect(() => { audio.update(shape, volume); }, [audio, shape, volume]);
  useEffect(() => { influenceRef.current = influence; }, [influence]);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, lastMeter = 0, smoothed = 0;
    function draw(now: number) {
      const rect = element!.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
      if (element!.width !== width || element!.height !== height) { element!.width = width; element!.height = height; }
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      smoothed = followLevel(smoothed, microphone.level());
      drawSoundRibbon(context!, rect.width, rect.height, shapeRef.current, smoothed * influenceRef.current, now / 1000, motion.matches);
      if (now - lastMeter > 150) { setLevel(smoothed); lastMeter = now; }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [microphone]);
  useEffect(() => {
    const pause = () => {
      playTurn.current++; micTurn.current++; clearTimeout(micTimer.current);
      audio.stop(); microphone.stop(); stopHands.current(); stopHands.current = () => {};
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
      clearTimeout(micTimer.current); stopHands.current(); audio.dispose(); microphone.stop();
      window.removeEventListener('blur', pause); window.removeEventListener('keydown', escape);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [audio, microphone]);

  return <section className={css.instrument} aria-label="Listening Again sound instrument">
    <header className={css.header}>
      <div><p className={css.eyebrow}>LISTENING AGAIN / HANDS + SURROUNDINGS</p><h2>A sound you can shape.</h2></div>
      <div className={css.headerActions}><span className={css.tempo}>148 <small>BPM</small></span><button onClick={() => { stopAll(); onLeave(); }}>Return to XR passage</button></div>
    </header>
    <div className={css.visual}>
      <canvas ref={canvas} aria-label="A suspended sound ribbon. Stretch changes its width and tone; fold changes its curl and echoes; optional microphone level adds ripples." />
      <div className={css.sceneNote}><span>THE RIGHT TO REVISE</span><p>Your hands shape the sound.<br />The room can leave a ripple.</p></div>
      <div className={css.sceneReadout} aria-hidden="true"><span>STRETCH {Math.round(shape.stretch * 100)}%</span><span>FOLD {Math.round(shape.fold * 100)}%</span><span>{micState === 'on' ? 'ROOM LISTENING' : 'ROOM OFF'}</span></div>
    </div>
    <div className={css.desk}>
      <div className={css.transport}>
        <label className={css.file}>Choose local 148 BPM sketch<input type="file" accept=".wav,audio/wav,audio/x-wav" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void load(file); }} /></label>
        <div className={css.actions}><button className={css.play} disabled={!duration || loading || starting} onClick={() => playing ? stopPlayback() : void play()}>{starting ? 'Starting…' : playing ? 'Stop sketch' : 'Play sketch'}</button><button onClick={stopAll}>Stop everything</button></div>
        <p>{loading ? 'Opening local WAV…' : duration ? `Local loop ready · ${duration.toFixed(2)} seconds · source tempo stays unchanged` : 'Choose the original 148 BPM WAV. The file stays in this tab.'}</p>
        <label className={css.slider}>Volume <output>{Math.round(volume * 100)}%</output><input aria-label="Sketch volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(unit(Number(event.target.value)))} /></label>
      </div>
      <div className={css.handControls}>
        <h3>01 / Your hands</h3>
        <p>Two hands apart to stretch. Open your fingers to unfold; curl them to add folds and echoes.</p>
        <button aria-pressed={handsOn} onClick={toggleHands}>{handsOn ? 'Freeze hands · camera off' : 'Enable hand shaping'}</button>
        <canvas ref={preview} width={320} height={240} hidden={!handsOn} className={css.preview} aria-label="Mirrored local hand preview" />
        <p role="status">{handMessage}</p>
        <label className={css.slider}>Stretch / tone <output>{Math.round(shape.stretch * 100)}%</output><input aria-label="Stretch sound" type="range" min="0" max="1" step="0.01" value={shape.stretch} onChange={event => changeShape({ ...shapeRef.current, stretch: unit(Number(event.target.value)) })} /></label>
        <label className={css.slider}>Fold / echoes <output>{Math.round(shape.fold * 100)}%</output><input aria-label="Fold sound" type="range" min="0" max="1" step="0.01" value={shape.fold} onChange={event => changeShape({ ...shapeRef.current, fold: unit(Number(event.target.value)) })} /></label>
      </div>
      <div className={css.roomControls}>
        <h3>02 / The room around you</h3>
        <button role="switch" aria-checked={micState !== 'off'} onClick={() => void toggleMicrophone()}>{micState === 'on' ? 'Nearby sound on · microphone on' : micState === 'asking' ? 'Waiting for microphone · cancel' : 'Let nearby sound influence the form'}</button>
        <p>Microphone level adds ripples, without changing the beat. Use headphones to hear the room separately from this sketch.</p>
        <label className={css.slider}>Ambient influence <output>{Math.round(influence * 100)}%</output><input aria-label="Ambient influence" type="range" min="0" max="1" step="0.01" value={influence} onChange={event => setInfluence(unit(Number(event.target.value)))} /></label>
        <label className={css.meter}>Nearby sound level <meter aria-label="Nearby sound level" min={0} max={1} value={micState === 'on' ? level : 0} /></label>
        <p className={css.privacy}>Camera and microphone start only when you enable them. Nothing is recorded, transcribed, uploaded or saved. Leaving this view stops both.</p>
      </div>
    </div>
    <footer className={css.footer}><p role="status">{message}</p><p>Tabula-inspired prototype · musical choices do not accept an AI interpretation. No IOANA sample is bundled.</p></footer>
  </section>;
}
