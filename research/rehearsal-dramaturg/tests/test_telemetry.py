import json
import httpx
import pytest
from dramaturg import telemetry

@pytest.mark.asyncio
async def test_disabled_never_reads_credentials(monkeypatch):
    monkeypatch.delenv("DRAMATURG_TELEMETRY",raising=False)
    assert await telemetry.record_run(10,"success") == "disabled"

@pytest.mark.asyncio
async def test_export_allowlist_and_target_check(tmp_path,monkeypatch):
    monkeypatch.setenv("DRAMATURG_TELEMETRY","1")
    monkeypatch.setattr(telemetry,"__file__",str(tmp_path/"a"/"b"/"c"/"telemetry.py"))
    directory=tmp_path/".logfire";directory.mkdir()
    credential=directory/"logfire_credentials.json"
    data={"token":"synthetic-test-token","project_url":"https://logfire-eu.pydantic.dev/adinablazrx/starter-project","logfire_api_url":"https://logfire-eu.pydantic.dev"}
    credential.write_text(json.dumps(data))
    captured=[]
    async def handle(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200,json={})
    original=httpx.AsyncClient
    monkeypatch.setattr(telemetry.httpx,"AsyncClient",lambda **kwargs:original(transport=httpx.MockTransport(handle),**kwargs))
    assert await telemetry.record_run(10,"success") == "export-accepted"
    serialized=json.dumps(captured)
    assert "synthetic-test-token" not in serialized
    assert all(word not in serialized for word in ["direction","prompt","exception","scene","hostname"])
    data["project_url"]="https://logfire.pydantic.dev/wrong/project"
    credential.write_text(json.dumps(data))
    assert await telemetry.record_run(10,"success") == "target-mismatch"
    assert len(captured)==1

def test_context_metrics_use_export_time_and_delta_counts(monkeypatch):
    monkeypatch.setattr(telemetry.time,'time_ns',lambda:10_000_000_000)
    packet=telemetry.context_metric_packet(10,'success','replay')
    metrics=packet['resourceMetrics'][0]['scopeMetrics'][0]['metrics']
    assert metrics[0]['sum']['aggregationTemporality']==1
    point=metrics[0]['sum']['dataPoints'][0]
    assert point['timeUnixNano']=='10000000000'
    assert point['startTimeUnixNano']=='9990000000'
    assert point['asDouble']==1.0
    for invalid in [float('inf'),float('nan'),-1]:
        with pytest.raises(ValueError):telemetry.context_metric_packet(invalid,'success','validation')

@pytest.mark.parametrize('body,expected',[
    ({},'export-accepted'),
    ({'partialSuccess':{'rejectedDataPoints':'0'}},'export-accepted'),
    ({'partialSuccess':{'rejectedDataPoints':'1'}},'export-rejected'),
    ({'partialSuccess':{'errorMessage':'warning'}},'export-accepted-with-warning'),
    ([],'export-unconfirmed'),
])
def test_otlp_acknowledgement(body,expected):
    assert telemetry.metric_response_status(httpx.Response(200,json=body))==expected

@pytest.mark.asyncio
async def test_context_disabled_never_exports(monkeypatch):
    monkeypatch.delenv('BODY_CONTEXT_TELEMETRY',raising=False)
    assert await telemetry.record_context(1,'success','replay')=='disabled'
