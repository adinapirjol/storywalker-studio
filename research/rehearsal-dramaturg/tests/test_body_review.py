import json
import pytest
from datetime import datetime, timedelta, timezone
from dramaturg.body_review import ReviewInput, review

BASE=datetime(2030,5,1,tzinfo=timezone.utc)
def sample(i, value, seconds=None, source='test-health'):
    t=BASE+timedelta(seconds=i*30 if seconds is None else seconds)
    return dict(id=f'test-{i}',source_id=source,source_type='healthkit',event_start=t.isoformat(),event_end=t.isoformat(),received_at=(BASE+timedelta(hours=1,seconds=100-i)).isoformat(),original_offset='+00:00',semantics='measurement',acquisition='historical',provenance='source_recorded',payload=dict(kind='heart_rate',value=value))
async def run(rows, **rules):
    return await review(ReviewInput.model_validate_json(json.dumps(dict(observations=rows,rule=dict(enabled=True,**rules)))))

@pytest.mark.asyncio
async def test_event_order_duplicates_stable_replay_and_no_promotion():
    rows=[sample(i,v) for i,v in enumerate([80,131,135,140,145,80])]
    result=await run(list(reversed(rows))+[rows[2]])
    again=await run(rows)
    assert len(result.markers)==1
    assert result.markers==again.markers
    assert result.markers[0].evidence_ids==['test-1','test-2','test-3']
    assert not result.canonical and result.notifications==0
    assert len(result.observations)==6

@pytest.mark.asyncio
async def test_gap_and_cross_source_never_supply_coverage():
    assert (await run([sample(0,150),sample(1,150,300),sample(2,150,600)])).status=='insufficient-context'
    assert not (await run([sample(0,150,source='a'),sample(1,150,source='b'),sample(2,150,source='a')])).markers

@pytest.mark.asyncio
async def test_recovery_hysteresis_and_cooldown():
    values=[140]*3+[128,140,140,140,120]+[140]*10
    result=await run([sample(i,v) for i,v in enumerate(values)])
    assert len(result.markers)==2
    assert (result.markers[1].end-result.markers[0].end).total_seconds()>=300

@pytest.mark.asyncio
async def test_low_disabled_deleted_and_unknown_context():
    rows=[sample(i,45) for i in range(3)]
    assert not (await run(rows)).markers
    assert (await run(rows,lower_bpm=50)).markers[0].direction=='below'
    assert not (await run([])).markers
    disabled=ReviewInput.model_validate_json(json.dumps(dict(observations=rows,rule={})))
    assert (await review(disabled)).status=='disabled'

@pytest.mark.asyncio
async def test_offsets_same_instants_and_conflicts():
    rows=[sample(i,140) for i in range(3)]
    expected=await run(rows)
    for row in rows:
        row['event_start']=datetime.fromisoformat(row['event_start']).astimezone(timezone(timedelta(hours=3))).isoformat()
        row['event_end']=row['event_start']
    assert (await run(rows)).markers[0].id==expected.markers[0].id
    duplicate={**rows[0],'payload':dict(kind='heart_rate',value=160)}
    with pytest.raises(ValueError):await run(rows+[duplicate])

@pytest.mark.asyncio
async def test_disallowed_sources_and_bounds():
    for source in ['fictional','spotify','author']:
        with pytest.raises(ValueError):await run([{**sample(0,140),'source_type':source}])
    with pytest.raises(ValueError):await run([],upper_bpm=40,lower_bpm=100)

@pytest.mark.asyncio
async def test_burst_at_one_time_never_counts_as_three_measurements():
    rows=[sample(0,140,0),sample(1,140,0),sample(2,140,60)]
    assert not (await run(rows,max_gap_s=60)).markers
