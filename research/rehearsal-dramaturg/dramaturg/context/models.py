from datetime import datetime, timedelta
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, FiniteFloat, model_validator

class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, json_schema_serialization_defaults_required=True)

class Heart(Contract):
    kind: Literal['heart_rate'] = 'heart_rate'
    # Research plausibility envelope, not a clinical alarm threshold.
    value: FiniteFloat = Field(gt=0, le=300)
    unit: Literal['bpm'] = 'bpm'
class Sleep(Contract):
    kind: Literal['sleep'] = 'sleep'
    stage: Literal['inBed', 'awake', 'asleep', 'core', 'deep', 'rem']

class Activity(Contract):
    kind: Literal['activity'] = 'activity'
    label: str = Field(max_length=100)
class Location(Contract):
    kind: Literal['location'] = 'location'
    label: str = Field(max_length=100)
    accuracy_m: FiniteFloat = Field(ge=0)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
class Listening(Contract):
    kind: Literal['listening'] = 'listening'
    label: str = Field(max_length=100)
    policy: Literal['original', 'author_marker', 'fictional']
    tempo_bpm: FiniteFloat | None = Field(default=None, gt=0, le=400)
class Marker(Contract):
    kind: Literal['marker'] = 'marker'
    label: str = Field(max_length=200)
Payload = Annotated[Heart | Sleep | Activity | Location | Listening | Marker, Field(discriminator='kind')]
class Observation(Contract):
    schema_version: Literal[1] = 1
    id: str = Field(min_length=1, max_length=100)
    source_id: str = Field(min_length=1, max_length=100)
    source_type: Literal['fictional','apple_health_export','healthkit','core_location','author','original_audio'] = 'fictional'
    source_revision: str = Field(default='1',max_length=100)
    device_revision: str | None = Field(default=None,max_length=100)
    event_start: AwareDatetime
    event_end: AwareDatetime
    received_at: AwareDatetime
    original_offset: str = Field(max_length=30)
    semantics: Literal['measurement', 'interval', 'author_marker']
    acquisition: Literal['simulated', 'historical', 'live']
    provenance: Literal['source_recorded', 'author_stated']
    quality: list[str] = Field(default_factory=list, max_length=10)
    payload: Payload
    @model_validator(mode='after')
    def interval(self):
        if self.event_end < self.event_start: raise ValueError('invalid_interval')
        return self
# Measurement and app-receipt clocks may differ; never rewrite source time.
CLOCK_SKEW = timedelta(seconds=120)

def validate_measurement_time(observation: Observation, now: datetime) -> None:
    if observation.received_at + CLOCK_SKEW < observation.event_end:
        raise ValueError('receipt_precedes_measurement')
    if observation.event_end > now + CLOCK_SKEW or observation.received_at > now + CLOCK_SKEW:
        raise ValueError('future_observation')

class Rule(Contract):
    id: str = 'fictional-high'
    version: int = 1
    enabled: bool = False
    priority: int = Field(default=0,ge=0,le=100)
    required_lanes: list[Literal['heart_rate','activity','location','listening','marker']] = Field(default_factory=lambda:['heart_rate'],max_length=5)
    direction: Literal['high', 'low'] = 'high'
    threshold: FiniteFloat | None = None
    duration_s: int = Field(default=30, ge=1, le=600)
    gap_s: int = Field(default=10, ge=1, le=120)
    hysteresis: FiniteFloat = Field(default=10, ge=0)
    cooldown_s: int = Field(default=60, ge=0)
    before_s: int = Field(default=30, ge=0, le=600)
    after_s: int = Field(default=30, ge=0, le=600)
class Match(Contract):
    observation_id: str
    overlap_s: FiniteFloat = Field(ge=0)
    age_at_trigger_s: FiniteFloat
    relation: Literal['point','interval','location_carry_forward']

class ContextWindow(Contract):
    id: str
    start: AwareDatetime
    end: AwareDatetime
    observation_ids: list[str]
    revision: int
    tolerance_s: int = 5
    matches: list[Match] = Field(default_factory=list,max_length=512)
    missing_lanes: list[str]
    stale_location: bool
    coverage_s: int
    uncertainty: str
    complete: bool
class Capture(Contract):
    rule_id: str = 'fictional-high'
    rule_snapshot: Rule = Field(default_factory=lambda:Rule(enabled=True,threshold=120))
    id: str
    rule_version: int
    triggering_ids: list[str]
    event_time: AwareDatetime
    captured_at: AwareDatetime
    reason: str
    context: ContextWindow
    context_history: list[ContextWindow] = Field(default_factory=list,max_length=128)
    notification_eligible: Literal[False] = False
class Proposal(Contract):
    id: str
    capture_id: str
    revision: int
    context_revision: int
    evidence_ids: list[str]
    account: str
    question: str
    caveats: str
    method: Literal['deterministic', 'manual'] = 'deterministic'
class Decision(Contract):
    id: str
    author: Literal['local-author'] = 'local-author'
    proposal_id: str
    target_revision: int
    status: Literal['accepted','revised','refused','unresolved']
    text: str | None = Field(default=None, max_length=2000)
    decided_at: AwareDatetime
class Memory(Contract):
    id: str
    version: int
    decision_id: str
    context_revision: int
    evidence_ids: list[str]
    text: str
    support: Literal['supported','needs_review','invalidated'] = 'supported'
    previous_id: str | None = None
class Placement(Contract):
    memory_id: str
    x: FiniteFloat = Field(ge=-20,le=20)
    author: Literal['local-author'] = 'local-author'
    at: AwareDatetime

class RuleLatch(Contract):
    armed: bool = True
    last_capture: AwareDatetime | None = None

class State(Contract):
    schema_version: Literal[1] = 1
    revision: int = 0
    cursor: int = 0
    now: AwareDatetime
    next_delivery_at: AwareDatetime | None = None
    observations: list[Observation] = Field(default_factory=list, max_length=512)
    event_index: list[str] = Field(default_factory=list,max_length=512)
    end_index: list[str] = Field(default_factory=list,max_length=512)
    captures: list[Capture] = Field(default_factory=list, max_length=32)
    proposals: list[Proposal] = Field(default_factory=list, max_length=64)
    decisions: list[Decision] = Field(default_factory=list, max_length=128)
    memories: list[Memory] = Field(default_factory=list, max_length=128)
    placements: list[Placement] = Field(default_factory=list,max_length=128)
    rule: Rule = Field(default_factory=Rule)
    additional_rules: list[Rule] = Field(default_factory=list,max_length=4)
    latches: dict[str,RuleLatch] = Field(default_factory=dict,max_length=5)
    armed: bool = True
    last_capture: AwareDatetime | None = None
    status: str = 'ready'
    reflection: str = Field(default='', max_length=2000)
    deleted_sources: list[str] = Field(default_factory=list, max_length=100)
    @model_validator(mode='after')
    def integrity(self):
        observations={o.id for o in self.observations}
        if len(observations)!=len(self.observations):raise ValueError('duplicate_observation')
        if not self.event_index:self.event_index=[o.id for o in sorted(self.observations,key=lambda o:(o.event_start,o.id))]
        if not self.end_index:self.end_index=[o.id for o in sorted(self.observations,key=lambda o:(o.event_end,o.id))]
        if set(self.event_index)!=observations or set(self.end_index)!=observations:raise ValueError('invalid_temporal_index')
        by_id={o.id:o for o in self.observations}
        if self.event_index!=sorted(self.event_index,key=lambda id:(by_id[id].event_start,id)) or self.end_index!=sorted(self.end_index,key=lambda id:(by_id[id].event_end,id)):raise ValueError('unordered_temporal_index')
        captures={c.id:c for c in self.captures}
        proposals={p.id:p for p in self.proposals}
        decisions={d.id:d for d in self.decisions}
        if len(captures)!=len(self.captures) or len(proposals)!=len(self.proposals) or len(decisions)!=len(self.decisions):raise ValueError('duplicate_reference')
        for c in self.captures:
            if not set(c.triggering_ids)<=observations:raise ValueError('unknown_trigger')
            for w in [c.context,*c.context_history]:
                if not set(w.observation_ids)<=observations or not {m.observation_id for m in w.matches}<=set(w.observation_ids):raise ValueError('unknown_context_reference')
        for p in self.proposals:
            if p.capture_id not in captures or not set(p.evidence_ids)<=observations:raise ValueError('unknown_proposal_reference')
        for d in self.decisions:
            if d.proposal_id not in proposals or d.target_revision!=proposals[d.proposal_id].revision:raise ValueError('unknown_decision_revision')
        memory_ids={m.id for m in self.memories}
        if any(p.memory_id not in memory_ids for p in self.placements):raise ValueError('unknown_placement')
        for m in self.memories:
            d=decisions.get(m.decision_id)
            if not d or d.status not in ('accepted','revised'):raise ValueError('automatic_promotion_forbidden')
            p=proposals[d.proposal_id];c=captures[p.capture_id]
            if m.text!=(d.text or p.account):raise ValueError('unapproved_memory_text')
            if m.context_revision!=p.context_revision or not any(w.revision==m.context_revision for w in [c.context,*c.context_history]):raise ValueError('unknown_approved_context')
            if not set(m.evidence_ids)<=observations:raise ValueError('unknown_memory_support')
            if m.previous_id is not None and m.previous_id not in memory_ids:raise ValueError('unknown_lineage')
        return self

class Command(Contract):
    action: Literal['step','reset','decide','delete','reflect','place','configure']
    expected_revision: int = Field(ge=0)
    proposal_id: str | None = None
    target_revision: int | None = None
    status: Literal['accepted','revised','refused','unresolved'] | None = None
    text: str = Field(default='', max_length=2000)
    source_id: str | None = None
    memory_id: str | None = None
    position_x: FiniteFloat | None = Field(default=None,ge=-20,le=20)
    capture_enabled: bool | None = None
class Packet(Contract):
    state: State | None = None
    command: Command
