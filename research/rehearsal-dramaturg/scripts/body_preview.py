"""Rebuild the public, fictional BODY design sample from the existing workflow."""
import asyncio
from pathlib import Path
from dramaturg.context.engine import initial, fixtures, process
from dramaturg.context.models import Packet, Command, State

async def main():
    state=initial()
    for _ in fixtures():
        state=await process(Packet(state=state, command=Command(action='step', expected_revision=state.revision)))
    state=State.model_validate_json(state.model_dump_json())
    assert all(o.source_type=='fictional' and o.acquisition=='simulated' for o in state.observations)
    assert not state.memories and not state.decisions and not state.reflection
    (Path(__file__).resolve().parents[3]/'lib/body/body-preview.fictional.json').write_text(state.model_dump_json(indent=2)+'\n')

if __name__=='__main__': asyncio.run(main())
