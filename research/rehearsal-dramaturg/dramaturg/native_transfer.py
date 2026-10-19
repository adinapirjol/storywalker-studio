"""Local stdin validation only: no telemetry, files, provider access or error inputs."""
from datetime import datetime, timezone
from collections.abc import Callable
import base64
import json
import sys
from typing import Literal
from uuid import UUID
from pydantic import Field, model_validator
from .context.models import Contract, Observation, validate_measurement_time

class WireDelivery(Contract):
    id: str = Field(min_length=1, max_length=110)
    deletion: bool
    packet: str = Field(max_length=16384)

class NativeBatch(Contract):
    version: Literal[1]
    batch_id: str
    mode: Literal['simulated', 'healthkit']
    deliveries: list[WireDelivery] = Field(min_length=1, max_length=200)

    @model_validator(mode='after')
    def identifiers(self):
        if str(UUID(self.batch_id)) != self.batch_id:
            raise ValueError('batch_id')
        if len({d.id for d in self.deliveries}) != len(self.deliveries):
            raise ValueError('duplicate_delivery')
        return self

class ValidatedTransfer(Contract):
    version: Literal[1]
    batch_id: str
    mode: Literal['simulated', 'healthkit']
    observations: list[Observation] = Field(max_length=200)
    deletions: list[str] = Field(max_length=200)

def validate_transfer(raw: bytes, clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> dict:
    now = clock()
    if len(raw) > 1_048_576:
        raise ValueError('limit')
    batch = NativeBatch.model_validate_json(raw)
    observations, deletions = [], []
    for item in batch.deliveries:
        packet = base64.b64decode(item.packet, validate=True)
        if item.deletion:
            target = packet.decode('utf-8')
            if not target or len(target) > 100 or item.id != 'delete:' + target:
                raise ValueError('deletion_reference')
            deletions.append(target)
            continue
        observation = Observation.model_validate_json(packet)
        if observation.id != item.id or observation.payload.kind not in ('heart_rate', 'sleep'):
            raise ValueError('reference_or_kind')
        if batch.mode == 'simulated':
            if observation.acquisition != 'simulated' or observation.source_type != 'fictional':
                raise ValueError('mode')
        elif observation.source_type != 'healthkit' or observation.acquisition not in ('live', 'historical'):
            raise ValueError('mode')
        expected_semantics = 'interval' if observation.payload.kind == 'sleep' else 'measurement'
        if observation.payload.kind == 'sleep' and observation.event_end <= observation.event_start:
            raise ValueError('empty_sleep_interval')
        if observation.provenance != 'source_recorded' or observation.semantics != expected_semantics:
            raise ValueError('provenance')
        if batch.mode == 'healthkit':
            validate_measurement_time(observation, now)
        value = observation.model_dump(mode='json')
        original = json.loads(packet)
        for field in ('event_start', 'event_end', 'received_at'):
            value[field] = original[field]
        observations.append(value)
    return dict(version=1,batch_id=batch.batch_id,mode=batch.mode,observations=observations,deletions=deletions)

def main():
    try:
        clock = (lambda: datetime.fromisoformat(sys.argv[1])) if len(sys.argv) == 2 else lambda: datetime.now(timezone.utc)
        result = validate_transfer(sys.stdin.buffer.read(1_048_577), clock)
        sys.stdout.write(json.dumps(result,allow_nan=False))
    except Exception:
        sys.stderr.write('NATIVE_TRANSFER_INVALID\n')
        raise SystemExit(2)

if __name__ == '__main__':
    main()
