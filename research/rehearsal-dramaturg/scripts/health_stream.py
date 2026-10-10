"""stdout is a private local pipe to the encrypted Vault adapter, never telemetry."""
import json, sys
from pathlib import Path
from dramaturg.context.health_import import stream_archive, stream_heart_records
try:
    path=Path(sys.argv[1]); batch=[]; count=0
    with path.open('rb') as stream:
        records=stream_archive(path) if path.suffix.lower()=='.zip' else stream_heart_records(stream)
        for record in records:
            count+=1
            if count>10000:raise ValueError('selected_import_limit')
            batch.append(record.model_dump(mode='json'))
            if len(batch)==100:print(json.dumps(batch),flush=True);batch=[]
        if batch:print(json.dumps(batch),flush=True)
except Exception:
    print('Import rejected; no source values logged.',file=sys.stderr)
    sys.exit(1)
