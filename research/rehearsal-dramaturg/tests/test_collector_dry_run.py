import json
import pytest
from dramaturg.collector_dry_run import validate_native_output, rehearse
from dramaturg.context.engine import fixtures

def test_rejects_real_data_and_unbounded_batches():
    observation = fixtures()[0].model_dump(mode='json')
    observation['acquisition'] = 'live'
    with pytest.raises(ValueError):validate_native_output(json.dumps(observation).encode())
    with pytest.raises(ValueError):validate_native_output(b'x'*1_000_001)
    with pytest.raises(ValueError):validate_native_output(b'{}\n'*257)

@pytest.mark.asyncio
async def test_mock_replay_is_grounded_without_promotion_or_export():
    observations = validate_native_output(b'\n'.join(o.model_dump_json().encode() for o in fixtures()))
    report = await rehearse(observations)
    assert report['captures'] == 2
    assert report['duplicate_deliveries'] == 3
    assert report['canonical_memories'] == report['notifications'] == 0
    assert report['logfire'] == 'off'
