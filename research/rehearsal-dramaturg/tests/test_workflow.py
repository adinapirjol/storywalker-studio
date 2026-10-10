import asyncio
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from dramaturg.app import app
from dramaturg.models import Request
from dramaturg.workflow import Workflow, MockAdapter

async def progress(stage):
    pass

@pytest.mark.asyncio
async def test_three_bounded_fictional_scores():
    result = await Workflow().run(Request(direction="departure coast"), progress)
    assert len(result.scores) == 3
    assert result.canonical is False
    assert all(b.start_seconds+b.duration_seconds<=120 for s in result.scores for b in s.timing)

@pytest.mark.asyncio
@pytest.mark.parametrize("mutation", ["fabricated", "bounds", "timing", "duplicate"])
async def test_rejects_bad_model_output(mutation):
    mock = MockAdapter()
    workflow = Workflow(mock)
    request = Request(direction="departure")
    raw = await mock.propose(request, workflow.retrieve(request))
    cue = raw["scores"][0]["scene"]["cues"][0]
    if mutation == "fabricated": cue["provenance"] = "Invented lived fact"
    if mutation == "bounds": cue["x"] = 21
    if mutation == "timing": raw["scores"][0]["timing"][0]["cue_id"] = "absent"
    if mutation == "duplicate": raw["scores"][1]["id"] = raw["scores"][0]["id"]
    mock.propose = AsyncMock(return_value=raw)
    with pytest.raises(ValueError):
        await workflow.run(request, progress)

@pytest.mark.asyncio
async def test_missing_catalogue():
    workflow = Workflow()
    workflow.retriever.ainvoke = AsyncMock(return_value=[])
    with pytest.raises(ValueError):
        await workflow.run(Request(direction="coast"), progress)

@pytest.mark.asyncio
async def test_timeout_and_cancellation_release_slot():
    adapter = MockAdapter()
    cancelled = asyncio.Event()
    async def slow(*args):
        try: await asyncio.sleep(5)
        finally: cancelled.set()
    adapter.propose = slow
    workflow = Workflow(adapter, timeout=.02)
    with pytest.raises(TimeoutError): await workflow.run(Request(direction="coast"), progress)
    assert cancelled.is_set()
    assert workflow.slots._value == 2
    task = asyncio.create_task(workflow.run(Request(direction="coast"), progress))
    await asyncio.sleep(.001)
    task.cancel()
    with pytest.raises(asyncio.CancelledError): await task
    assert workflow.slots._value == 2

def test_http_and_websocket():
    with TestClient(app) as client:
        assert client.get("/health").json()["fictional_only"]
        assert client.post("/scores",json={"direction":"coast"}).status_code == 200
        assert client.post("/scores",json={"direction":"coast","private_scene":{}}).status_code == 422
        with client.websocket_connect("/rehearse",headers={"origin":"http://localhost:3000"}) as ws:
            ws.send_json({"direction":"coast"})
            messages = [ws.receive_json() for _ in range(4)]
            assert [m["type"] for m in messages] == ["progress","progress","progress","result"]

@pytest.mark.asyncio
async def test_concurrency_is_bounded():
    active=0
    peak=0
    mock=MockAdapter()
    original=mock.propose
    async def tracked(*args):
        nonlocal active,peak
        active+=1;peak=max(peak,active)
        await asyncio.sleep(.005)
        result=await original(*args)
        active-=1
        return result
    mock.propose=tracked
    workflow=Workflow(mock)
    await asyncio.gather(*(workflow.run(Request(direction="coast"),progress) for _ in range(6)))
    assert peak==2

def test_websocket_invalid_request_and_origin():
    with TestClient(app) as client:
        with pytest.raises(Exception):
            with client.websocket_connect("/rehearse",headers={"origin":"https://untrusted.example"}):
                pass
        with client.websocket_connect("/rehearse",headers={"origin":"http://localhost:3000"}) as ws:
            ws.send_json({"direction":"coast","private_scene":{}})
            assert ws.receive_json()["type"]=="error"

def test_websocket_cancels_running_model(monkeypatch):
    from dramaturg import app as module
    async def slow(*args):
        await asyncio.sleep(10)
    monkeypatch.setattr(module.workflow.adapter,"propose",slow)
    with TestClient(app) as client:
        with client.websocket_connect("/rehearse",headers={"origin":"http://localhost:3000"}) as ws:
            ws.send_json({"direction":"coast"})
            assert ws.receive_json()["stage"]=="retrieving"
            ws.send_json({"type":"cancel"})
            messages=[ws.receive_json()]
            if messages[0]["type"]=="progress":messages.append(ws.receive_json())
            assert messages[-1]["type"]=="cancelled"
