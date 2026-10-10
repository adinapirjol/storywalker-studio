"""Native fictional mapper -> Pydantic -> graph, with optional allowlisted metrics.

No Vault, HealthKit access, source-file argument, persistent state or external AI.
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from .context.models import Observation, Packet, Command
from .context.engine import initial, process
from .telemetry import record_context
from .run_record import save_record


def validate_native_output(raw: bytes) -> list[Observation]:
    if len(raw) > 1_000_000:
        raise ValueError('packet_limit')
    lines = raw.splitlines()
    if not 1 <= len(lines) <= 256:
        raise ValueError('delivery_limit')
    observations = [Observation.model_validate_json(line) for line in lines]
    if any(o.acquisition != 'simulated' or o.source_type != 'fictional' for o in observations):
        raise ValueError('fictional_only')
    return observations


async def rehearse(observations, export=False):
    state = initial()
    exported = []
    for _ in observations:
        started = time.monotonic()
        packet = Packet.model_validate_json(Packet(state=state, command=Command(action='step', expected_revision=state.revision)).model_dump_json())
        state = await process(packet, simulated_deliveries=observations)
        if export:
            exported.append(await record_context((time.monotonic()-started)*1000, 'success', 'replay'))
    unique = len({o.id for o in observations})
    if len(state.observations) != unique or not state.captures or state.memories or any(c.notification_eligible for c in state.captures):
        raise ValueError('dry_run_invariant')
    before = len(state.captures)
    # End-of-stream retry cannot create a duplicate capture.
    again = await process(Packet(state=state, command=Command(action='step', expected_revision=state.revision)), simulated_deliveries=observations)
    if len(again.captures) != before:
        raise ValueError('retry_invariant')
    return {'mode':'fictional-native-dry-run','deliveries':len(observations),'validated_observations':unique,
            'duplicate_deliveries':len(observations)-unique,'captures':before,
            'context_revisions':sum(len(c.context_history) for c in state.captures),
            'canonical_memories':len(state.memories),'notifications':0,
            'logfire': {status:exported.count(status) for status in sorted(set(exported))} if export else 'off',
            'physical_device_verified':False}


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--logfire', action='store_true', help='Send only operation counts and latency to the existing EU project')
    parser.add_argument('--record', action='store_true', help='Save a payload-free fictional run record under repository tmp/pydantic-runs')
    args = parser.parse_args()
    os.environ['BODY_CONTEXT_TELEMETRY'] = '1' if args.logfire else '0'
    native = Path(__file__).resolve().parents[2] / 'body-context-native'
    try:
        result = await asyncio.to_thread(subprocess.run, ['swift','run','--package-path',str(native),'collector-dry-run'], capture_output=True, timeout=300, check=True)
        observations = validate_native_output(result.stdout)
        report = await rehearse(observations, args.logfire)
        if args.record:
            saved = save_record(report, native.parents[1] / 'tmp' / 'pydantic-runs')
            print(f'Run record saved: {saved}', file=sys.stderr)
        print(json.dumps(report, indent=2))
        if args.logfire and set(report['logfire']) != {'export-accepted'}:
            raise SystemExit(2)
    except (subprocess.SubprocessError, ValueError, OSError):
        # Pydantic errors can contain inputs. Never dump them or captured output.
        print(json.dumps({'status':'failed','error':'collector_dry_run_failed','details':'Run native tests and Python tests locally; source values and credentials are omitted.'}))
        raise SystemExit(1) from None


if __name__ == '__main__':
    asyncio.run(main())
