import json
import pytest
from dramaturg.run_record import save_record

REPORT=dict(mode='fictional-native-dry-run',deliveries=17,validated_observations=14,duplicate_deliveries=3,captures=2,context_revisions=6,canonical_memories=0,notifications=0,logfire='off',physical_device_verified=False)
def test_records_are_distinct_and_reject_private_fields(tmp_path):
    one=save_record(REPORT,tmp_path)
    two=save_record(REPORT,tmp_path)
    assert one!=two
    value=json.loads(one.read_text())
    assert value['validated_observations']==14 and value['physical_device_verified'] is False
    assert one.stat().st_mode & 0o777 == 0o600
    for change in [dict(observations=[dict(value=90)]),dict(mode='healthkit'),dict(physical_device_verified=True),dict(notifications=1)]:
        with pytest.raises(ValueError):save_record({**REPORT,**change},tmp_path)
    assert len(list(tmp_path.iterdir()))==2
