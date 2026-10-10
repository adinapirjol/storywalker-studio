"""Entirely invented HealthKit-shaped research observations."""
from datetime import datetime, timezone
import base64
import json
import pytest
from dramaturg.native_transfer import validate_transfer

def packet(change=None):
    observation=dict(schema_version=1,id='fictional-pr2',source_id='fictional-pr2',source_type='healthkit',source_revision='1',event_start='2020-01-01T00:00:00Z',event_end='2020-01-01T00:00:00Z',received_at='2020-01-01T00:00:01Z',original_offset='unknown',semantics='measurement',acquisition='historical',provenance='source_recorded',quality=[],payload=dict(kind='heart_rate',value=80.0,unit='bpm'))
    if change=='negative':observation['payload']['value']=-5.0
    if change=='high':observation['payload']['value']=9000.0
    if change=='future':observation.update(event_start='2046-01-01T00:00:00Z',event_end='2046-01-01T00:00:00Z',received_at='2046-01-01T00:00:01Z')
    if change=='receipt-before':observation['received_at']='2014-01-01T00:00:00Z'
    return json.dumps(dict(version=1,batch_id='00000000-0000-4000-8000-000000000002',mode='healthkit',deliveries=[dict(id=observation['id'],deletion=False,packet=base64.b64encode(json.dumps(observation).encode()).decode())])).encode()

@pytest.mark.parametrize('change',['negative','high','future','receipt-before'])
def test_m1_rejects_invalid_research_observations(change):
    with pytest.raises(ValueError):validate_transfer(packet(change),clock=lambda:datetime(2026,10,10,tzinfo=timezone.utc))

def with_observation(**changes):
    raw=json.loads(packet())
    observation=json.loads(base64.b64decode(raw['deliveries'][0]['packet']))
    observation.update(changes)
    raw['deliveries'][0]['packet']=base64.b64encode(json.dumps(observation).encode()).decode()
    return json.dumps(raw).encode()

@pytest.mark.parametrize('value',[0.0,300.01])
def test_rejects_plausibility_outside_bounds(value):
    with pytest.raises(ValueError):
        validate_transfer(with_observation(payload=dict(kind='heart_rate',value=value,unit='bpm')))

@pytest.mark.parametrize('value',[0.1,300.0])
def test_accepts_plausibility_envelope_without_clinical_interpretation(value):
    result=validate_transfer(with_observation(payload=dict(kind='heart_rate',value=value,unit='bpm')))
    assert result['observations'][0]['payload']['value']==value

def test_clock_skew_boundary_and_original_source_strings():
    now=lambda:datetime(2020,1,1,tzinfo=timezone.utc)
    raw=with_observation(event_start='2020-01-01T02:02:00+02:00',event_end='2020-01-01T02:02:00+02:00',received_at='2020-01-01T00:00:00Z')
    result=validate_transfer(raw,clock=now)['observations'][0]
    assert result['event_start']=='2020-01-01T02:02:00+02:00'
    assert result['received_at']=='2020-01-01T00:00:00Z'
    with pytest.raises(ValueError):
        validate_transfer(with_observation(event_start='2020-01-01T00:02:01Z',event_end='2020-01-01T00:02:01Z'),clock=now)
    with pytest.raises(ValueError):
        validate_transfer(with_observation(received_at='2019-12-31T23:57:59Z'),clock=now)
    with pytest.raises(ValueError):
        validate_transfer(with_observation(received_at='2020-01-01T00:02:01Z'),clock=now)
