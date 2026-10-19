from datetime import datetime
import base64
import json
import subprocess
import sys
from uuid import uuid4
import pytest
from dramaturg.context.engine import fixtures
from dramaturg.native_transfer import validate_transfer

def wire(observation=None, mode='simulated'):
    o = observation or next(o for o in fixtures() if o.payload.kind == 'heart_rate').model_dump(mode='json')
    return dict(version=1,batch_id=str(uuid4()),mode=mode,deliveries=[dict(id=o['id'],deletion=False,packet=base64.b64encode(json.dumps(o).encode()).decode())])

def test_validates_plausibility_boundary_and_retains_event_time():
    o=next(o for o in fixtures() if o.payload.kind == 'heart_rate').model_dump(mode='json');o['payload']['value']=300.0
    batch=validate_transfer(json.dumps(wire(o)).encode())
    assert batch['observations'][0]['payload']['value']==300.0
    assert batch['observations'][0]['event_start']==o['event_start']

def test_healthkit_watch_metadata_remains_historical_source_evidence():
    # Synthetic contract fixture, never a real HealthKit export.
    o=next(o for o in fixtures() if o.payload.kind == 'heart_rate').model_dump(mode='json')
    o.update(source_type='healthkit',source_id='test.synthetic.health',acquisition='historical',
             quality=['recorded_on_apple_watch','original_timezone_unknown'],original_offset='unknown')
    result=validate_transfer(json.dumps(wire(o,mode='healthkit')).encode(),clock=lambda:datetime.fromisoformat(o['received_at']))
    saved=result['observations'][0]
    assert saved['acquisition']=='historical'
    assert saved['quality']==o['quality']
    assert saved['provenance']=='source_recorded'
    assert set(result)=={'version','batch_id','mode','observations','deletions'}

@pytest.mark.parametrize('change',['spoof','spotify','nan','duplicate','oversize','wrong-kind','id'])
def test_rejects_untrusted_packets(change):
    o=next(o for o in fixtures() if o.payload.kind == 'heart_rate').model_dump(mode='json')
    if change=='spoof':o['source_type']='healthkit'
    if change=='spotify':o['source_type']='spotify'
    if change=='nan':o['payload']['value']=float('nan')
    if change=='wrong-kind':o['payload']={'kind':'marker','label':'untrusted'}
    b=wire(o)
    if change=='duplicate':b['deliveries']*=2
    if change=='oversize':b['deliveries']*=201
    if change=='id':b['deliveries'][0]['id']='fabricated'
    with pytest.raises(ValueError):validate_transfer(json.dumps(b).encode())

def test_deletion_is_a_separate_operation():
    b=wire();b['deliveries']=[dict(id='delete:sample',deletion=True,packet=base64.b64encode(b'sample').decode())]
    assert validate_transfer(json.dumps(b).encode())['deletions']==['sample']
    b['deliveries'][0]['id']='wrong'
    with pytest.raises(ValueError):validate_transfer(json.dumps(b).encode())

def test_errors_never_echo_input():
    result=subprocess.run([sys.executable,'-m','dramaturg.native_transfer'],input=b'{"secret":"private-canary-reflection"}',capture_output=True)
    assert result.returncode==2
    assert result.stdout==b''
    assert result.stderr==b'NATIVE_TRANSFER_INVALID\n'

@pytest.mark.parametrize('stage',['inBed','asleep','awake','core','deep','rem'])
def test_sleep_interval_contract(stage):
    o=next(o for o in fixtures() if o.payload.kind == 'heart_rate').model_dump(mode='json')
    o.update(source_type='healthkit',source_id='invented.watch',acquisition='historical',semantics='interval',
             event_start='2030-05-01T00:00:00+03:00',event_end='2030-05-01T08:00:00+03:00',
             payload={'kind':'sleep','stage':stage},original_offset='Europe/Bucharest')
    result=validate_transfer(json.dumps(wire(o,mode='healthkit')).encode(),clock=lambda:datetime.fromisoformat(o['received_at']))
    assert result['observations'][0]['payload']['stage']==stage
    o['semantics']='measurement'
    with pytest.raises(ValueError):validate_transfer(json.dumps(wire(o,mode='healthkit')).encode(),clock=lambda:datetime.fromisoformat(o['received_at']))
    o['semantics']='interval';o['event_end']=o['event_start']
    with pytest.raises(ValueError):validate_transfer(json.dumps(wire(o,mode='healthkit')).encode(),clock=lambda:datetime.fromisoformat(o['received_at']))
