"""Explicitly enabled health summaries only. No Logfire SDK or model instrumentation."""
import hashlib
import json
import sys
from typing import Literal
from pydantic import AwareDatetime, Field, FiniteFloat
from .context.models import Contract
from .native_transfer import ValidatedTransfer

class ReceivedSummary(Contract):
    version: Literal[1] = 1
    summary_id: str = Field(pattern=r'^[a-f0-9]{64}$')
    source: Literal['watch', 'phone-health']
    received_count: int = Field(ge=1, le=200)
    preferred_count: int = Field(ge=1, le=200)
    maximum_bpm: FiniteFloat
    received_start: AwareDatetime
    received_end: AwareDatetime

def summarize(batch: ValidatedTransfer) -> ReceivedSummary | None:
    if batch.mode != 'healthkit':
        return None
    deleted = set(batch.deletions)
    samples = [o for o in batch.observations if o.id not in deleted and o.payload.kind == 'heart_rate']
    if not samples:
        return None
    watch = [o for o in samples if 'recorded_on_apple_watch' in o.quality]
    preferred = watch or samples
    return ReceivedSummary(
        summary_id=hashlib.sha256(('storywalker-summary-v1:' + batch.batch_id).encode()).hexdigest(),
        source='watch' if watch else 'phone-health', received_count=len(samples),
        preferred_count=len(preferred), maximum_bpm=max(o.payload.value for o in preferred),
        received_start=min(o.received_at for o in samples), received_end=max(o.received_at for o in samples),
    )

def main():
    try:
        raw=sys.stdin.buffer.read(2_097_153)
        if len(raw)>2_097_152: raise ValueError('limit')
        summary=summarize(ValidatedTransfer.model_validate_json(raw))
        sys.stdout.write(json.dumps(summary.model_dump(mode='json') if summary else None,allow_nan=False))
    except Exception:
        sys.stderr.write('SUMMARY_INVALID\n')
        raise SystemExit(2)
if __name__ == '__main__': main()
