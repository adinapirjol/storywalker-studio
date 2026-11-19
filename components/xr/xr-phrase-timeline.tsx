import { formatPhraseTime, phraseTimeline } from '@/lib/xr/phrase-timeline';
import type { LinguisticScore } from '@/lib/xr/linguistic-score';
import css from './xr-phrase-timeline.module.css';

type Props = { position: number; duration: number; playing: boolean; starting: boolean; score: LinguisticScore | null; activeCue: number; onTogglePlayback: () => void };

export function XRPhraseTimeline({ position, duration, playing, starting, score, activeCue, onTogglePlayback }: Props) {
  const timeline = phraseTimeline(position, score?.source.durationSeconds ?? duration, score?.source.offsetSeconds ?? 0);
  return <>
    <div className={css.clock} aria-label="Visible playback clock">
      <span>{score ? 'SOURCE TIME' : 'CLIP TIME'} · {playing ? 'PLAYING' : 'STOPPED'}</span>
      <output aria-label={score ? 'Source playback time' : 'Clip playback time'} aria-live="off">{formatPhraseTime(timeline.sourceTime)}</output>
      {score && <small>clip +{formatPhraseTime(timeline.elapsed)}</small>}
      <button disabled={starting} onClick={onTogglePlayback}>{starting ? 'Starting…' : playing ? 'Stop here' : 'Play / replay here'}</button>
    </div>
    <div className={css.timeline}>
      <div className={css.legend}><span>{score ? 'ORIGINAL RECORDING' : 'SELECTED CLIP'} · {formatPhraseTime(timeline.offset)}–{formatPhraseTime(timeline.end)}</span><span>{score?.cues.some(cue => cue.accent) ? 'NUMBERED DOTS = WORD / BEAT MARKERS' : score ? 'NUMBERED DOTS = PHRASE CUES' : 'SECONDS'}</span></div>
      <div className={css.ruler} role="progressbar" aria-label={score ? 'Source time ruler' : 'Clip time ruler'} aria-valuemin={timeline.offset} aria-valuemax={timeline.end} aria-valuenow={Number(timeline.sourceTime.toFixed(1))} aria-valuetext={`${formatPhraseTime(timeline.sourceTime)} of ${formatPhraseTime(timeline.end)}`}>
        <div className={css.track} aria-hidden="true" />
        {timeline.ticks.map(tick => <span key={tick.sourceSeconds} className={`${css.tick} ${tick.major ? css.major : ''}`} style={{ left: `${tick.percent}%` }} aria-hidden="true">
          {tick.major && <small>{formatPhraseTime(tick.sourceSeconds).slice(0, -2)}</small>}
        </span>)}
        {timeline.length > 0 && score?.cues.map((cue, index) => <span key={cue.id} className={`${css.cue} ${index === activeCue ? css.active : ''} ${cue.timing === 'proposed' ? css.proposed : ''} ${cue.accent?.kind === 'drop' ? css.drop : ''}`} style={{ left: `${cue.startSeconds / timeline.length * 100}%` }} title={`${index + 1}. ${cue.title} · ${formatPhraseTime(timeline.offset + cue.startSeconds)} · ${cue.timing === 'proposed' ? 'approximate' : 'Author-marked'}${cue.accent ? ` · ${cue.accent.kind}: ${cue.accent.reaction}` : ''}`} aria-hidden="true">{index + 1}</span>)}
        <span className={css.playhead} style={{ left: `${timeline.percent}%` }} aria-hidden="true"><i /></span>
      </div>
    </div>
  </>;
}
