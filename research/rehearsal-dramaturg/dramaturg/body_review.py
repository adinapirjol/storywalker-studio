"""Bounded private historical review. No telemetry, network, files or notifications."""
import asyncio
from dataclasses import dataclass
from datetime import timedelta
from hashlib import sha256
import json
import sys
from typing import Literal
from pydantic import AwareDatetime, Field, FiniteFloat, model_validator
from pydantic_graph import BaseNode, End, GraphBuilder, GraphRunContext, StepContext
from .context.models import Contract, Observation

class ReviewRule(Contract):
    enabled: bool = False
    lower_bpm: FiniteFloat | None = None
    upper_bpm: FiniteFloat | None = 130.0
    duration_s: int = Field(default=60, ge=0, le=3600)
    max_gap_s: int = Field(default=30, ge=1, le=300)
    min_samples: int = Field(default=3, ge=2, le=200)
    hysteresis_bpm: FiniteFloat = Field(default=5.0, ge=0, le=100)
    cooldown_s: int = Field(default=300, ge=0, le=86400)

    @model_validator(mode='after')
    def bounds(self):
        if self.enabled and self.lower_bpm is None and self.upper_bpm is None:
            raise ValueError('bounds_required')
        if any(x is not None and not 0 < x <= 400 for x in (self.lower_bpm, self.upper_bpm)):
            raise ValueError('invalid_bound')
        if self.lower_bpm is not None and self.upper_bpm is not None and self.lower_bpm >= self.upper_bpm:
            raise ValueError('invalid_order')
        return self

class ReviewInput(Contract):
    observations: list[Observation] = Field(max_length=200)
    rule: ReviewRule

    @model_validator(mode='after')
    def sources(self):
        seen = {}
        for o in self.observations:
            if o.source_type != 'healthkit' or o.acquisition not in ('historical', 'live') or o.payload.kind != 'heart_rate' or o.provenance != 'source_recorded':
                raise ValueError('private_health_required')
            key = (o.source_id, o.id)
            if key in seen and seen[key] != o.model_dump(exclude={'received_at'}):
                raise ValueError('conflicting_delivery')
            seen[key] = o.model_dump(exclude={'received_at'})
        return self

class ReviewMarker(Contract):
    id: str
    direction: Literal['above', 'below']
    start: AwareDatetime
    end: AwareDatetime
    evidence_ids: list[str]
    window_start: AwareDatetime
    window_end: AwareDatetime
    context_ids: list[str]
    status: Literal['awaiting-author'] = 'awaiting-author'

class BodyReview(Contract):
    schema_version: Literal[1] = 1
    rule: ReviewRule
    observations: list[Observation]
    markers: list[ReviewMarker] = Field(default_factory=list)
    status: Literal['disabled', 'insufficient-context', 'no-crossing', 'awaiting-author'] = 'disabled'
    notifications: Literal[0] = 0
    canonical: Literal[False] = False

@dataclass
class Evaluate(BaseNode[BodyReview, None, BodyReview]):
    async def run(self, ctx: GraphRunContext[BodyReview]) -> End[BodyReview]:
        s, rule = ctx.state, ctx.state.rule
        if not rule.enabled:
            return End(s)
        s.status = 'insufficient-context'
        sources = sorted({o.source_id for o in s.observations})
        enough = False
        for source in sources:
            rows = [o for o in s.observations if o.source_id == source]
            for direction, bound in [('above', rule.upper_bpm), ('below', rule.lower_bpm)]:
                if bound is None:
                    continue
                run, coverage = [], []
                latched, last_trigger, previous = False, None, None
                for o in rows:
                    if previous is not None and (o.event_start - previous).total_seconds() > rule.max_gap_s:
                        run, coverage = [], []
                        # Missing evidence does not prove recovery: retain latch.
                    coverage.append(o)
                    if len({r.event_start for r in coverage}) >= rule.min_samples and (o.event_start - coverage[0].event_start).total_seconds() >= rule.duration_s:
                        enough = True
                    previous = o.event_start
                    value = o.payload.value
                    beyond = value > bound if direction == 'above' else value < bound
                    recovered = value <= bound-rule.hysteresis_bpm if direction == 'above' else value >= bound+rule.hysteresis_bpm
                    if recovered:
                        latched = False
                    if not beyond:
                        run = []
                        continue
                    run.append(o)
                    if latched or len({r.event_start for r in run}) < rule.min_samples or (o.event_start-run[0].event_start).total_seconds() < rule.duration_s:
                        continue
                    if last_trigger is not None and (o.event_start-last_trigger).total_seconds() < rule.cooldown_s:
                        continue
                    start, end = run[0].event_start-timedelta(seconds=30), o.event_start+timedelta(seconds=30)
                    identity = json.dumps([source,direction,rule.model_dump(),[r.id for r in run]],sort_keys=True)
                    s.markers.append(ReviewMarker(id=sha256(identity.encode()).hexdigest()[:24],direction=direction,start=run[0].event_start,end=o.event_start,evidence_ids=[r.id for r in run],window_start=start,window_end=end,context_ids=[r.id for r in s.observations if start <= r.event_start <= end]))
                    latched, last_trigger = True, o.event_start
        s.status = 'awaiting-author' if s.markers else 'no-crossing' if enough else 'insufficient-context'
        return End(s)

builder = GraphBuilder(state_type=BodyReview, input_type=ReviewInput, output_type=BodyReview, auto_instrument=False)
@builder.step
async def start(ctx: StepContext[BodyReview, None, ReviewInput]) -> Evaluate:
    return Evaluate()
builder.add(builder.edge_from(builder.start_node).to(start))
builder.add(builder.node(Evaluate))
graph = builder.build()

async def review(data: ReviewInput) -> BodyReview:
    # Event-time order, independent of transfer/arrival; identical duplicates count once.
    unique = {}
    for o in sorted(data.observations,key=lambda o:(o.received_at,o.id)):
        unique.setdefault((o.source_id,o.id),o)
    observations = sorted(unique.values(),key=lambda o:(o.event_start,o.id))
    state = BodyReview(rule=data.rule, observations=observations)
    return await graph.run(inputs=data,state=state)

def main():
    try:
        raw=sys.stdin.buffer.read(1_048_577)
        if len(raw)>1_048_576:
            raise ValueError('limit')
        result=asyncio.run(review(ReviewInput.model_validate_json(raw)))
        sys.stdout.write(result.model_dump_json())
    except Exception:
        sys.stderr.write('BODY_REVIEW_INVALID\n')
        raise SystemExit(2)

if __name__ == '__main__':
    main()
