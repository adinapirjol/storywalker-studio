"""Payload-free proof of fictional rehearsal. No source data or free-form errors."""
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict, Field

class RehearsalRecord(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal[1] = 1
    run_id: UUID = Field(default_factory=uuid4)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mode: Literal['fictional-native-dry-run']
    deliveries: int = Field(ge=0)
    validated_observations: int = Field(ge=0)
    duplicate_deliveries: int = Field(ge=0)
    captures: int = Field(ge=0)
    context_revisions: int = Field(ge=0)
    canonical_memories: Literal[0]
    notifications: Literal[0]
    logfire: Literal['off'] | dict[Literal['export-accepted','export-rejected','export-unavailable','export-unconfirmed','export-accepted-with-warning','disabled','unsafe-credential-path','unsafe-path','target-mismatch','unsupported-outcome'], int]
    physical_device_verified: Literal[False]

def save_record(report: dict, folder: Path) -> Path:
    record = RehearsalRecord.model_validate(report)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = folder / f'{record.recorded_at:%Y%m%dT%H%M%SZ}-{record.run_id}.json'
    with target.open('x', encoding='utf-8') as stream:
        target.chmod(0o600)
        stream.write(record.model_dump_json(indent=2)+'\n')
    return target
