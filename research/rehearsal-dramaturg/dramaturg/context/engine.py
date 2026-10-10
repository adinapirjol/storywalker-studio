from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pydantic_graph import BaseNode, End, GraphBuilder, GraphRunContext, StepContext
from .models import *
from .temporal import TemporalIndex
from bisect import insort_right
BASE = datetime(2030, 5, 1, 12, tzinfo=timezone.utc)
def identity(value): return sha256(value.encode()).hexdigest()[:16]
def fixtures():
    result=[]
    def add(id, seconds, arrival, payload, source='fictional-body', end=None):
        result.append(Observation(id=id,source_id=source,event_start=BASE+timedelta(seconds=seconds),event_end=BASE+timedelta(seconds=seconds if end is None else end),received_at=BASE+timedelta(seconds=arrival),original_offset='+00:00',semantics='author_marker' if payload['kind']=='marker' else 'interval' if end is not None else 'measurement',acquisition='simulated',provenance='author_stated' if payload['kind']=='marker' else 'source_recorded',payload=payload))
    add('sound',10,10,dict(kind='listening',label='An original bell study',policy='fictional',tempo_bpm=96),'fictional-audio',100)
    add('world',15,15,dict(kind='location',label='Imagined tidal courtyard',accuracy_m=120,city='Tidal City',country='Imagined Coast'),'fictional-world')
    add('activity',0,0,dict(kind='activity',label='walking'),'fictional-activity',25)
    for i,value in enumerate([70,75,80,130,132,134,136,80,75,130,131,132,133]): add(f'hr-{i}',i*10,i*10,dict(kind='heart_rate',value=value))
    add('late',35,85,dict(kind='heart_rate',value=131))
    add('note',32,82,dict(kind='marker',label='A pause to read the wall'),'fictional-marker')
    for arrival in [86,87,88]:result.append(result[6].model_copy(update={'received_at':BASE+timedelta(seconds=arrival)}))
    return sorted(result,key=lambda o:(o.received_at,o.id))
def initial(): return State(now=BASE,next_delivery_at=fixtures()[0].received_at,rule=Rule(enabled=True,threshold=120))
def join(s,c):
    selected=TemporalIndex(s).window(c.context.start,c.context.end,c.event_time)
    ids=[o.id for o in selected]
    lanes={o.payload.kind for o in s.observations if o.id in ids}
    if not any(o.payload.kind=='activity' and o.event_start<=c.event_time<=o.event_end for o in s.observations):lanes.discard('activity')
    loc=[o for o in s.observations if o.id in ids and o.payload.kind=='location']
    complete=s.now>=c.context.end
    if ids!=c.context.observation_ids or complete!=c.context.complete:
        c.context_history.append(c.context.model_copy(deep=True))
        c.context=c.context.model_copy(update=dict(observation_ids=ids,revision=c.context.revision+1,complete=complete,matches=[Match(observation_id=o.id,overlap_s=max(0,(min(o.event_end,c.context.end)-max(o.event_start,c.context.start)).total_seconds()),age_at_trigger_s=(c.event_time-o.event_start).total_seconds(),relation='location_carry_forward' if o.payload.kind=='location' and o.event_end<c.context.start else 'point' if o.event_start==o.event_end else 'interval') for o in selected],missing_lanes=sorted({'activity','location','listening'}-lanes),stale_location=not loc or (c.event_time-max(o.event_start for o in loc)).total_seconds()>30))
        for m in s.memories:
            if m.id.startswith(c.id) and m.support=='supported': m.support='needs_review'

def propose(s,c):
    old=[p for p in s.proposals if p.capture_id==c.id]
    if old and old[-1].context_revision==c.context.revision: return
    p=Proposal(id=f'{c.id}:proposal:{len(old)+1}',capture_id=c.id,revision=len(old)+1,context_revision=c.context.revision,evidence_ids=c.context.observation_ids,account='A sampled body change coincided with this available context. Its meaning remains open.' if c.triggering_ids else 'The body source was removed. Previous meaning has lost its supporting evidence and needs review.',question='What else was happening? Missing activity prevents a resting comparison.',caveats='Temporal overlap establishes neither emotion nor causation. Location is approximate.')
    s.proposals.append(p)
@dataclass
class Validate(BaseNode[State,None,State]):
    packet: Packet
    deliveries: list[Observation]
    async def run(self,ctx:GraphRunContext[State]) -> Execute | Invalid:
        if self.packet.command.expected_revision!=ctx.state.revision: return Invalid()
        return Execute(self.packet.command, self.deliveries)
@dataclass
class Invalid(BaseNode[State,None,State]):
    async def run(self,ctx:GraphRunContext[State]) -> End[State]:
        ctx.state.status='invalid-input'
        raise ValueError('stale_revision')

@dataclass
class Execute(BaseNode[State,None,State]):
    command: Command
    deliveries: list[Observation]
    async def run(self,ctx:GraphRunContext[State]) -> Join | Author | End[State]:
        s=ctx.state; cmd=self.command
        if cmd.action=='step':
            events=self.deliveries
            if s.cursor>=len(events): s.status='done'; return End(s)
            o=events[s.cursor]; s.cursor+=1; s.now=o.received_at
            if o.source_id not in s.deleted_sources and not any(x.id==o.id for x in s.observations):
                s.observations.append(o)
                by_id={x.id:x for x in s.observations}
                insort_right(s.event_index,o.id,key=lambda id:(by_id[id].event_start,id))
                insort_right(s.end_index,o.id,key=lambda id:(by_id[id].event_end,id))
            s.status='waiting-for-more-data'
            return Join()
        if cmd.action=='configure':
            if cmd.capture_enabled is None:raise ValueError('configuration_required')
            s.rule.enabled=cmd.capture_enabled
        if cmd.action=='reflect': s.reflection=cmd.text
        if cmd.action=='place':
            if cmd.position_x is None or not any(m.id==cmd.memory_id for m in s.memories):raise ValueError('unknown_placement')
            s.placements.append(Placement(memory_id=cmd.memory_id,x=cmd.position_x,at=s.now))
        if cmd.action=='delete':
            if not cmd.source_id: raise ValueError('source_required')
            if cmd.source_id in s.deleted_sources:return End(s)
            ids={o.id for o in s.observations if o.source_id==cmd.source_id}
            s.deleted_sources.append(cmd.source_id); s.observations=[o for o in s.observations if o.id not in ids]
            s.event_index=[id for id in s.event_index if id not in ids];s.end_index=[id for id in s.end_index if id not in ids]
            for c in s.captures:
                c.triggering_ids=[id for id in c.triggering_ids if id not in ids]
                c.context_history.append(c.context.model_copy(deep=True))
                c.context.revision+=1
                for w in [c.context,*c.context_history]:
                    w.observation_ids=[id for id in w.observation_ids if id not in ids];w.matches=[m for m in w.matches if m.observation_id not in ids]
            for p in s.proposals: p.evidence_ids=[id for id in p.evidence_ids if id not in ids]
            for m in s.memories:
                if ids.intersection(m.evidence_ids): m.evidence_ids=[id for id in m.evidence_ids if id not in ids]; m.support='invalidated'
            return Join()
        if cmd.action=='decide': return Author(cmd)
        return End(s)
@dataclass
class Join(BaseNode[State,None,State]):
    async def run(self,ctx:GraphRunContext[State]) -> Evaluate:
        for c in ctx.state.captures: join(ctx.state,c)
        return Evaluate()
@dataclass
class Evaluate(BaseNode[State,None,State]):
    async def run(self,ctx:GraphRunContext[State]) -> Review:
        s=ctx.state
        hearts=sorted((o for o in s.observations if o.payload.kind=='heart_rate'),key=lambda o:(o.event_start,o.id))
        if not hearts:s.status='insufficient-context';return Review()
        last=hearts[-1];value=last.payload.value
        rules=sorted([s.rule,*s.additional_rules],key=lambda r:(r.priority,r.id,r.version))
        occupied=any(c.event_time==last.event_start for c in s.captures)
        for r in rules:
            if not r.enabled or r.threshold is None:continue
            key=f'{r.id}:{r.version}'
            latch=s.latches.setdefault(key,RuleLatch())
            high=r.direction=='high';crossed=lambda v:v>=r.threshold if high else v<=r.threshold
            reset=value<=r.threshold-r.hysteresis if high else value>=r.threshold+r.hysteresis
            if reset:latch.armed=True
            tail=[]
            for o in reversed(hearts):
                if not crossed(o.payload.value) or (tail and (tail[-1].event_start-o.event_start).total_seconds()>r.gap_s):break
                tail.append(o)
            duration=(tail[0].event_start-tail[-1].event_start).total_seconds() if tail else 0
            cooldown=latch.last_capture is None or (last.event_start-latch.last_capture).total_seconds()>=r.cooldown_s
            if latch.armed and cooldown and duration>=r.duration_s:
                # All simultaneously eligible rules latch this burst; priority selects one bookmark.
                latch.armed=False;latch.last_capture=last.event_start
                if occupied:continue
                selected=TemporalIndex(s).window(last.event_start-timedelta(seconds=r.before_s),last.event_start+timedelta(seconds=r.after_s),last.event_start)
                lanes={o.payload.kind for o in selected}
                if not any(o.payload.kind=='activity' and o.event_start<=last.event_start<=o.event_end for o in selected):lanes.discard('activity')
                if not set(r.required_lanes)<=lanes:s.status='insufficient-context';continue
                id=identity(f'{r.id}:{r.version}:{last.id}')
                c=Capture(id=id,rule_id=r.id,rule_snapshot=r.model_copy(deep=True),rule_version=r.version,triggering_ids=[o.id for o in tail],event_time=last.event_start,captured_at=s.now,reason=f'Fictional {r.direction} threshold; {int(duration)}s sampled span, gaps ≤ {r.gap_s}s.',context=ContextWindow(id=id,start=last.event_start-timedelta(seconds=r.before_s),end=last.event_start+timedelta(seconds=r.after_s),observation_ids=[],revision=0,missing_lanes=[],stale_location=True,coverage_s=int(duration),uncertainty='Sample coverage is not confidence in meaning.',complete=False))
                s.captures.append(c);join(s,c);occupied=True
                s.armed=False;s.last_capture=last.event_start
        return Review()

@dataclass
class Review(BaseNode[State,None,State]):
    async def run(self,ctx:GraphRunContext[State]) -> End[State]:
        for c in ctx.state.captures: propose(ctx.state,c)
        if ctx.state.captures: ctx.state.status='awaiting-Author'
        return End(ctx.state)
@dataclass
class Author(BaseNode[State,None,State]):
    command: Command
    async def run(self,ctx:GraphRunContext[State]) -> End[State]:
        s=ctx.state;cmd=self.command
        p=next((p for p in s.proposals if p.id==cmd.proposal_id),None)
        if not p or p.revision!=cmd.target_revision: raise ValueError('stale_proposal')
        c=next(c for c in s.captures if c.id==p.capture_id)
        if (cmd.status in ('accepted','revised') and not c.triggering_ids) or c.context.revision!=p.context_revision or not set(p.evidence_ids)<= {o.id for o in s.observations}: raise ValueError('evidence_changed')
        if cmd.status is None: raise ValueError('decision_required')
        if cmd.status=='accepted' and cmd.text and cmd.text!=p.account:raise ValueError('use_revision_for_changed_text')
        if cmd.status=='revised' and not cmd.text.strip(): raise ValueError('revision_text_required')
        d=Decision(id=f'decision-{len(s.decisions)+1}',proposal_id=p.id,target_revision=p.revision,status=cmd.status,text=cmd.text or None,decided_at=s.now)
        s.decisions.append(d)
        if cmd.status in ('accepted','revised'):
            old=[m for m in s.memories if m.id.startswith(c.id)]
            s.memories.append(Memory(id=f'{c.id}:memory:{len(old)+1}',version=len(old)+1,decision_id=d.id,context_revision=p.context_revision,evidence_ids=p.evidence_ids,text=cmd.text or p.account,previous_id=old[-1].id if old else None))
        else:
            for m in s.memories:
                if m.id.startswith(c.id): m.support='needs_review'
        s.status=cmd.status
        return End(s)
@dataclass
class ReplayInput:
    packet: Packet
    deliveries: list[Observation]
builder=GraphBuilder(state_type=State,input_type=Packet | ReplayInput,output_type=State,auto_instrument=False)
@builder.step
async def start(ctx:StepContext[State,None,Packet | ReplayInput]) -> Validate:
    if isinstance(ctx.inputs, Packet):
        return Validate(ctx.inputs, fixtures())
    return Validate(ctx.inputs.packet, ctx.inputs.deliveries)
builder.add(builder.edge_from(builder.start_node).to(start))
for node in [Validate,Invalid,Execute,Join,Evaluate,Review,Author]: builder.add(builder.node(node))
graph=builder.build()
async def process(packet:Packet, *, simulated_deliveries:list[Observation] | None=None):
    events=fixtures() if simulated_deliveries is None else simulated_deliveries
    if len(events)>256 or any(o.acquisition!='simulated' or o.source_type!='fictional' for o in events):
        raise ValueError('fictional_replay_required')
    events=sorted(events,key=lambda o:(o.received_at,o.id))
    s=State.model_validate(packet.state.model_dump()) if packet.state else initial()
    if packet.command.action=='reset':
        if packet.command.expected_revision!=s.revision:raise ValueError('stale_revision')
        reset=initial();reset.revision=s.revision+1;return reset
    result=await graph.run(inputs=ReplayInput(packet,events),state=s)
    result.next_delivery_at=events[result.cursor].received_at if result.cursor<len(events) else None
    result.revision+=1
    return State.model_validate(result.model_dump())
