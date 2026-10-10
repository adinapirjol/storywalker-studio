"""Deterministic local research candidates. No telemetry, storage or medical labels."""
from hashlib import sha256
import sys
from typing import Literal
from pydantic import AwareDatetime, Field, FiniteFloat, model_validator
from .context.models import Contract
from .native_transfer import ValidatedTransfer

Kind = Literal['absolute-high', 'absolute-low', 'relative-elevation', 'sustained-change', 'rapid-change']

class ThresholdRule(Contract):
    lower_bpm: FiniteFloat | None = 50.0
    upper_bpm: FiniteFloat | None = 120.0
    resting_baseline_bpm: FiniteFloat | None = None
    baseline_confirmed: bool = False
    relative_delta_bpm: FiniteFloat = Field(default=30, gt=0, le=200)
    sustained_delta_bpm: FiniteFloat = Field(default=20, gt=0, le=200)
    sustained_duration_s: int = Field(default=300, ge=1, le=3600)
    rapid_delta_bpm: FiniteFloat = Field(default=30, gt=0, le=200)
    rapid_window_s: int = Field(default=120, ge=1, le=120)
    rest_only: bool = True
    duration_s: int = Field(default=0, ge=0, le=3600)
    min_samples: int = Field(default=2, ge=1, le=200)
    max_gap_s: int = Field(default=60, ge=1, le=300)
    hysteresis_bpm: FiniteFloat = Field(default=5, ge=0, le=100)
    cooldown_s: int = Field(default=300, ge=0, le=86400)
    grouping_s: int = Field(default=60, ge=1, le=120)

    @model_validator(mode='after')
    def bounds(self):
        if any(v is not None and not 0 < v <= 400 for v in (self.lower_bpm, self.upper_bpm, self.resting_baseline_bpm)):
            raise ValueError('invalid_bound')
        if self.lower_bpm is not None and self.upper_bpm is not None and self.lower_bpm >= self.upper_bpm:
            raise ValueError('invalid_order')
        if self.resting_baseline_bpm is not None and not self.baseline_confirmed:
            raise ValueError('measured_baseline_required')
        return self

class RestContext(Contract):
    start: AwareDatetime
    end: AwareDatetime

    @model_validator(mode='after')
    def window(self):
        if not 0 < (self.end-self.start).total_seconds() <= 600:
            raise ValueError('context_window')
        return self

class Run(Contract):
    latched: bool = False
    triggered: AwareDatetime | None = None
    start: AwareDatetime | None = None
    received_start: AwareDatetime | None = None
    count: int = Field(default=0, ge=0, le=1000000)
    extreme: FiniteFloat | None = None

class Lane(Contract):
    last: AwareDatetime | None = None
    last_value: FiniteFloat | None = None
    last_received: AwareDatetime | None = None
    source_key: str = ''
    runs: dict[Kind, Run] = Field(default_factory=dict, max_length=5)

class ThresholdState(Contract):
    watch: Lane = Field(default_factory=Lane)
    phone: Lane = Field(default_factory=Lane)

class ThresholdEvent(Contract):
    event_id: str = Field(pattern=r'^[a-f0-9]{64}$')
    rule_id: str = Field(pattern=r'^[a-f0-9]{64}$')
    kind: Kind
    direction: Literal['above', 'below']
    source: Literal['watch', 'phone-health']
    context: Literal['author-reported-rest', 'unknown']
    context_confounded: bool
    support: Literal['single-observation', 'repeated-observations', 'observed-delta']
    threshold_bpm: FiniteFloat
    extreme_bpm: FiniteFloat
    sample_count: int = Field(ge=1, le=1000000)
    measured_start: AwareDatetime
    measured_end: AwareDatetime
    received_start: AwareDatetime
    received_end: AwareDatetime

class ThresholdInput(Contract):
    rule: ThresholdRule
    state: ThresholdState = Field(default_factory=ThresholdState)
    batch: ValidatedTransfer | None = None
    context: RestContext | None = None
    now: AwareDatetime

    @model_validator(mode='after')
    def current_context(self):
        if self.context is not None and self.context.start > self.now:
            raise ValueError('future_context')
        return self

class ThresholdResult(Contract):
    rule: ThresholdRule
    state: ThresholdState
    events: list[ThresholdEvent] = Field(default_factory=list, max_length=1000)

def reset_run(run: Run):
    # Missing data does not establish recovery or re-arm the latch.
    run.start = run.received_start = run.extreme = None
    run.count = 0

def evaluate(data: ThresholdInput) -> ThresholdResult:
    result = ThresholdResult(rule=data.rule, state=data.state.model_copy(deep=True))
    if data.batch is None or data.batch.mode != 'healthkit':
        return result
    rule = data.rule
    rule_id = sha256(rule.model_dump_json().encode()).hexdigest()
    deleted = set(data.batch.deletions)
    rows = [o for o in data.batch.observations if o.id not in deleted
            and o.source_type == 'healthkit' and o.acquisition in ('live', 'historical')
            and o.payload.kind == 'heart_rate' and o.provenance == 'source_recorded'
            and o.semantics == 'measurement' and 0 <= (data.now-o.event_start).total_seconds() <= 120
            and o.event_start <= o.received_at <= data.now]
    watch = [o for o in rows if 'recorded_on_apple_watch' in o.quality]
    if not watch and result.state.watch.last is not None and 0 <= (data.now-result.state.watch.last).total_seconds() <= 120:
        return result
    source = 'watch' if watch else 'phone-health'
    lane = result.state.watch if watch else result.state.phone
    for o in sorted(watch or rows, key=lambda x: (x.event_start, x.id)):
        if lane.last is not None and o.event_start <= lane.last:
            continue
        source_key = sha256((o.source_id+':'+str(o.device_revision)).encode()).hexdigest()
        gap = (o.event_start-lane.last).total_seconds() if lane.last else None
        same_source = source_key == lane.source_key
        resting = data.context is not None and data.context.start <= o.event_start <= data.context.end
        poor_signal = any(q in o.quality for q in ('uncertain', 'invalid', 'poor_signal'))
        eligible = (resting or not rule.rest_only) and not poor_signal
        previous_value, previous_time, previous_received = lane.last_value, lane.last, lane.last_received
        if not same_source or gap is not None and gap > rule.max_gap_s or not eligible:
            for run in lane.runs.values():
                reset_run(run)
        lane.last, lane.source_key, lane.last_received = o.event_start, source_key, o.received_at
        lane.last_value = o.payload.value if eligible else None
        if not eligible:
            continue
        value = o.payload.value
        def event(kind, direction, bound, run, support):
            identity = f'{rule_id}:{source}:{kind}:{o.event_start.isoformat()}'
            result.events.append(ThresholdEvent(event_id=sha256(identity.encode()).hexdigest(),rule_id=rule_id,
                kind=kind,direction=direction,source=source,context='author-reported-rest' if resting else 'unknown',
                context_confounded=not resting,support=support,threshold_bpm=bound,extreme_bpm=run.extreme,
                sample_count=run.count,measured_start=run.start,measured_end=o.event_start,
                received_start=run.received_start,received_end=o.received_at))
            run.latched, run.triggered = True, o.event_start
            reset_run(run)
        baseline = rule.resting_baseline_bpm
        limits = [('absolute-high', 'above', rule.upper_bpm, rule.duration_s),
                  ('absolute-low', 'below', rule.lower_bpm, rule.duration_s),
                  ('relative-elevation', 'above', baseline+rule.relative_delta_bpm if baseline is not None else None, rule.duration_s),
                  ('sustained-change', 'above', baseline+rule.sustained_delta_bpm if baseline is not None else None, rule.sustained_duration_s)]
        for kind, direction, bound, duration in limits:
            if bound is None:
                continue
            run = lane.runs.setdefault(kind, Run())
            beyond = value >= bound if direction == 'above' else value < bound
            recovered = value < bound-rule.hysteresis_bpm if direction == 'above' else value >= bound+rule.hysteresis_bpm
            if recovered:
                run.latched = False
            if not beyond:
                reset_run(run)
                continue
            if run.start is None:
                run.start, run.received_start, run.extreme = o.event_start, o.received_at, value
            run.count = min(1000000, run.count+1)
            run.extreme = max(run.extreme, value) if direction == 'above' else min(run.extreme, value)
            if run.latched or run.count < rule.min_samples or (o.event_start-run.start).total_seconds() < duration:
                continue
            if run.triggered is not None and (o.event_start-run.triggered).total_seconds() < rule.cooldown_s:
                continue
            event(kind,direction,bound,run,'single-observation' if run.count == 1 else 'repeated-observations')
        # This is an observed delta between two samples, never a continuous rate of change.
        rapid = lane.runs.setdefault('rapid-change', Run())
        if source == 'watch' and same_source and previous_value is not None and gap is not None and 0 < gap <= rule.rapid_window_s:
            delta = value-previous_value
            if delta >= rule.rapid_delta_bpm and (rapid.triggered is None or (o.event_start-rapid.triggered).total_seconds() >= rule.cooldown_s):
                rapid.start, rapid.received_start, rapid.extreme, rapid.count = previous_time, previous_received, delta, 2
                event('rapid-change','above',rule.rapid_delta_bpm,rapid,'observed-delta')
    return result

def main():
    try:
        raw = sys.stdin.buffer.read(2097153)
        if len(raw) > 2097152:
            raise ValueError('limit')
        sys.stdout.write(evaluate(ThresholdInput.model_validate_json(raw)).model_dump_json())
    except Exception:
        sys.stderr.write('HEALTH_EVENT_INVALID\n')
        raise SystemExit(2)

if __name__ == '__main__':
    main()
