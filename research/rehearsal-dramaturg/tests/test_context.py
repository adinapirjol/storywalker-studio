import pytest
from datetime import timedelta
from pydantic import ValidationError
from dramaturg.context.models import *
from dramaturg.context.engine import *
async def run_until(n):
    s=initial()
    for _ in range(n):s=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    return s
@pytest.mark.asyncio
async def test_slice_late_decision_refusal_deletion():
    s=await run_until(10)
    assert len(s.captures)==1
    p=s.proposals[-1]
    s=await process(Packet(state=s,command=Command(action='decide',expected_revision=s.revision,proposal_id=p.id,target_revision=p.revision,status='accepted')))
    approved=s.memories[0].context_revision
    for _ in range(5):s=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    assert s.memories[0].context_revision==approved
    assert s.memories[0].support=='needs_review'
    assert len({o.id for o in s.observations})==len(s.observations)
    p=s.proposals[-1]
    s=await process(Packet(state=s,command=Command(action='decide',expected_revision=s.revision,proposal_id=p.id,target_revision=p.revision,status='refused')))
    assert s.decisions[-1].status=='refused' and s.observations
    s=await process(Packet(state=s,command=Command(action='delete',expected_revision=s.revision,source_id='fictional-body')))
    assert s.memories[0].support=='invalidated'
    assert all(o.source_id!='fictional-body' for o in s.observations)
@pytest.mark.asyncio
async def test_stale_and_no_automatic_canon():
    s=await run_until(10)
    assert not s.memories
    with pytest.raises(ValueError):await process(Packet(state=s,command=Command(action='step',expected_revision=0)))
    with pytest.raises(ValueError):await process(Packet(state=s,command=Command(action='decide',expected_revision=s.revision,proposal_id='fabricated',target_revision=1,status='accepted')))
@pytest.mark.asyncio
async def test_idempotency_and_sparse_gap():
    s=await run_until(len(fixtures()))
    assert len(s.captures)==2
    assert all(not c.notification_eligible for c in s.captures)
    s=initial();s.observations=[fixtures()[1]]
    s.rule.enabled=False
    result=await graph.run(inputs=Packet(state=s,command=Command(action='reflect',expected_revision=0)),state=s)
    assert not result.captures

def test_time_and_policy_boundaries():
    sample=fixtures()[0].model_dump()
    sample['event_start']='2030-05-01T12:00:00'
    with pytest.raises(ValidationError):Observation.model_validate(sample)
    sample=fixtures()[1].model_dump();sample['payload']={'kind':'listening','label':'restricted','policy':'spotify'}
    with pytest.raises(ValidationError):Observation.model_validate(sample)
    sample['payload']={'kind':'heart_rate','value':float('inf')}
    with pytest.raises(ValidationError):Observation.model_validate(sample)
    sample['payload']={'kind':'heart_rate','value':500}
    assert Observation.model_validate(sample).payload.value==500

def test_body_tempo_and_place_contract():
    assert Listening(label='Original cue',policy='original').tempo_bpm is None
    assert Location(label='Unknown hierarchy',accuracy_m=100).city is None
    for value in [0,-1,401,float('nan'),float('inf')]:
        with pytest.raises(ValidationError): Listening(label='Invalid',policy='fictional',tempo_bpm=value)
    with pytest.raises(ValidationError): Listening(label='Restricted',policy='spotify',tempo_bpm=120)
    sound=next(o for o in fixtures() if o.payload.kind=='listening')
    assert sound.payload.tempo_bpm==96 and sound.acquisition=='simulated'

def test_safe_health_stream():
    from io import BytesIO
    from dramaturg.context.health_import import stream_heart_records
    xml=b'<HealthData><Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="500" startDate="2026-10-04 01:00:00 +0300" endDate="2026-10-04 01:00:00 +0300"/></HealthData>'
    observation=list(stream_heart_records(BytesIO(xml)))[0]
    assert observation.acquisition=='historical' and observation.payload.value==500
    assert observation.original_offset=='+0300'
    with pytest.raises(Exception):list(stream_heart_records(BytesIO(b'<!DOCTYPE x [<!ENTITY a "secret">]><x>&a;</x>')))
    with pytest.raises(ValueError):list(stream_heart_records(BytesIO(xml),lambda:True))

@pytest.mark.asyncio
async def test_typed_editor_off_and_grounded():
    from dramaturg.context.proposals import EditorPacket, typed_proposal
    from pydantic_ai.models.test import TestModel
    packet=EditorPacket(selected=[dict(id='fictional',kind='fictional_marker',text='Original fictional pause')],preview_approved=True)
    with pytest.raises(ValueError):await typed_proposal(packet)
    model=TestModel(custom_output_args=dict(evidence_ids=['fictional'],proposed_account='A pause was marked.',unresolved_question='What else was happening?',caveats='Meaning remains unresolved.'))
    output=await typed_proposal(packet,model=model,enabled=True)
    assert output.evidence_ids==['fictional']
    bad=TestModel(custom_output_args=dict(evidence_ids=['invented'],proposed_account='A pause.',unresolved_question='What else?',caveats='Unknown.'))
    with pytest.raises(ValueError):await typed_proposal(packet,model=bad,enabled=True)

@pytest.mark.asyncio
async def test_event_time_not_arrival_and_gap():
    s=await run_until(10);c=s.captures[0]
    assert c.context.stale_location and 'activity' in c.context.missing_lanes
    assert 'world' in c.context.observation_ids
    while not any(o.id=='late' for o in s.observations):s=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    assert 'late' in s.captures[0].context.observation_ids
    assert s.captures[0].event_time==BASE+timedelta(seconds=60)
    sparse=initial();sparse.observations=[Observation(id=f'h{i}',source_id='fiction',event_start=BASE+timedelta(seconds=i*20),event_end=BASE+timedelta(seconds=i*20),received_at=BASE+timedelta(seconds=i*20),original_offset='+00:00',semantics='measurement',acquisition='simulated',provenance='source_recorded',payload=Heart(value=140)) for i in range(3)]
    await graph.run(inputs=Packet(command=Command(action='reflect',expected_revision=0)),state=sparse) # reflect cannot run capture
    from dramaturg.context.engine import Evaluate
    sparse.captures=[]
    # Exercise the actual evaluation branch through Join after a delivery.
    sparse.cursor=0
    sparse=await process(Packet(state=sparse,command=Command(action='step',expected_revision=0)))
    assert not sparse.captures

def test_dst_offsets_preserved():
    o=fixtures()[0].model_dump();o.update(event_start='2026-10-25T03:10:00+03:00',event_end='2026-10-25T03:10:00+02:00',original_offset='Europe/Bucharest')
    o["event_start"]=datetime.fromisoformat(o["event_start"]);o["event_end"]=datetime.fromisoformat(o["event_end"])
    result=Observation.model_validate(o)
    assert (result.event_end-result.event_start).total_seconds()==3600

def test_metric_allowlist_excludes_source_data():
    from dramaturg.telemetry import context_metric_packet
    import json
    payload=json.dumps(context_metric_packet(10,'success','author'))
    assert not any(value in payload for value in ['bpm','coordinates','reflection','source_id','event_start','received_at'])
    with pytest.raises(ValueError):context_metric_packet(1,'private reflection','author')

def test_automatic_promotion_and_fabricated_support_rejected():
    s=initial().model_dump()
    s['memories']=[dict(id='m',version=1,decision_id='imagined',context_revision=1,evidence_ids=[],text='No Author decision',support='supported',previous_id=None)]
    with pytest.raises(ValidationError):State.model_validate(s)

@pytest.mark.asyncio
async def test_overlapping_precedence_and_disable():
    s=initial();s.additional_rules=[Rule(id='secondary',enabled=True,threshold=125,priority=1)]
    for _ in range(10):s=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    assert len(s.captures)==1 and s.captures[0].rule_id=='fictional-high'
    assert not s.latches['secondary:1'].armed
    disabled=initial()
    disabled=await process(Packet(state=disabled,command=Command(action='configure',expected_revision=0,capture_enabled=False)))
    for _ in range(10):disabled=await process(Packet(state=disabled,command=Command(action='step',expected_revision=disabled.revision)))
    assert not disabled.captures and not disabled.memories

@pytest.mark.asyncio
async def test_low_rule_hysteresis_and_resume_checkpoint():
    import json
    s=initial();s.rule=Rule(id='fictional-low',direction='low',enabled=True,threshold=90)
    for _ in range(8):s=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    # Three early low samples span only 20s and cannot prove the required span.
    assert not s.captures
    resumed=State.model_validate_json(s.model_dump_json())
    next_a=await process(Packet(state=s,command=Command(action='step',expected_revision=s.revision)))
    next_b=await process(Packet(state=resumed,command=Command(action='step',expected_revision=resumed.revision)))
    assert next_a.model_dump()==next_b.model_dump()

@pytest.mark.asyncio
async def test_reset_keeps_monotonic_revision_and_rejects_stale_decision():
    s=await run_until(10);old=s.revision
    reset=await process(Packet(state=s,command=Command(action='reset',expected_revision=s.revision)))
    assert reset.revision==old+1 and not reset.observations and not reset.decisions
    with pytest.raises(ValueError):await process(Packet(state=reset,command=Command(action='reset',expected_revision=old)))
