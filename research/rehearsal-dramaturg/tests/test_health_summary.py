from datetime import datetime, timezone
from dramaturg.health_summary import summarize
from dramaturg.native_transfer import ValidatedTransfer
from dramaturg.context.models import Observation


def sample(id, bpm, watch=False):
    return Observation.model_validate(dict(schema_version=1,id=id,source_id='private-canary',source_type='healthkit',source_revision='1',event_start=datetime(2026,10,8,10,0,tzinfo=timezone.utc),event_end=datetime(2026,10,8,10,0,tzinfo=timezone.utc),received_at=datetime(2026,10,8,10,0,10,tzinfo=timezone.utc),original_offset='unknown',semantics='measurement',acquisition='historical',provenance='source_recorded',quality=['recorded_on_apple_watch'] if watch else [],payload=dict(kind='heart_rate',value=bpm,unit='bpm')))

def test_watch_preference_preserves_precision_and_excludes_raw_fields():
    batch=ValidatedTransfer(version=1,batch_id='fictional-batch',mode='healthkit',observations=[sample('phone',200),sample('watch-1',82.45,True),sample('watch-2',91.123,True)],deletions=[])
    summary=summarize(batch)
    assert summary.source=='watch' and summary.maximum_bpm==91.123
    assert summary.received_count==3 and summary.preferred_count==2
    assert 'private-canary' not in summary.model_dump_json()
    assert 'watch-2' not in summary.model_dump_json()
    assert summary.received_start==datetime(2026,10,8,10,0,10,tzinfo=timezone.utc)

def test_phone_fallback_deletion_and_fictional_exclusion():
    batch=ValidatedTransfer(version=1,batch_id='fictional-batch',mode='healthkit',observations=[sample('a',95),sample('deleted',190)],deletions=['deleted'])
    result=summarize(batch)
    assert result.source=='phone-health' and result.maximum_bpm==95
    batch.mode='simulated'
    assert summarize(batch) is None
    batch.mode='healthkit';batch.deletions=['a','deleted']
    assert summarize(batch) is None
