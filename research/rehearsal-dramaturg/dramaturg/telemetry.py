"""Opt-in OTLP metrics; no auto-instrumentation or request/error content."""
import json
import os
import time
import math
from pathlib import Path
import httpx

async def record_run(duration_ms: float, outcome: str):
    if os.getenv("DRAMATURG_TELEMETRY") != "1":
        return "disabled"
    root = Path(__file__).resolve().parents[3]
    directory = root / ".logfire"
    credential = directory / "logfire_credentials.json"
    if directory.is_symlink() or credential.is_symlink():
        return "unsafe-credential-path"
    try:
        data = json.loads(credential.read_text())
        if data.get("project_url") != "https://logfire-eu.pydantic.dev/adinablazrx/starter-project" or data.get("logfire_api_url") != "https://logfire-eu.pydantic.dev":
            return "target-mismatch"
        if outcome not in {"success", "failure", "cancelled"}:
            return "unsupported-outcome"
        payload = {"resourceMetrics": [{"resource": {"attributes": [{"key": "service.name", "value": {"stringValue": "storywalker-rehearsal-dramaturg"}}, {"key": "deployment.environment.name", "value": {"stringValue": "local-fictional"}}]}, "scopeMetrics": [{"scope": {"name": "dramaturg.allowlisted"}, "metrics": [{"name": "dramaturg.run.duration", "unit": "ms", "gauge": {"dataPoints": [{"timeUnixNano": str(time.time_ns()), "asDouble": round(duration_ms, 2), "attributes": [{"key": "outcome", "value": {"stringValue": outcome}}]}]}}]}]}]}
        async with httpx.AsyncClient(timeout=5, trust_env=False) as client:
            response = await client.post("https://logfire-eu.pydantic.dev/v1/metrics", headers={"Authorization": data["token"]}, json=payload)
            return metric_response_status(response)
    except Exception:
        return "export-unavailable"

def context_metric_packet(duration_ms: float, outcome: str, step: str):
    """Closed vocabulary only. Never accept a source ID, error text, or packet as a label."""
    if outcome not in {'success','failure'} or step not in {'processing','validation','author','replay'}:
        raise ValueError('unsupported_metric_label')
    if not math.isfinite(duration_ms) or duration_ms < 0:
        raise ValueError('invalid_metric_duration')
    # Export time, never a source observation's event or receipt time.
    end = time.time_ns()
    start = end - max(1, int(min(duration_ms, 86_400_000) * 1_000_000))
    labels = [{'key':'outcome','value':{'stringValue':outcome}}, {'key':'step','value':{'stringValue':step}}]
    return {'resourceMetrics':[{'resource':{'attributes':[
        {'key':'service.name','value':{'stringValue':'storywalker-context-research'}},
        {'key':'deployment.environment.name','value':{'stringValue':'local-fictional'}}
    ]},'scopeMetrics':[{'scope':{'name':'context.allowlisted'},'metrics':[
        {'name':'context.operations','sum':{'aggregationTemporality':1,'isMonotonic':True,'dataPoints':[
            {'startTimeUnixNano':str(start),'timeUnixNano':str(end),'asDouble':1.0,'attributes':labels}]}},
        {'name':'context.latency','unit':'ms','gauge':{'dataPoints':[
            {'timeUnixNano':str(end),'asDouble':round(duration_ms,2),'attributes':labels}]}}
    ]}]}]}

def metric_response_status(response):
    """Do not report partial rejection or an unexpected body as successful delivery."""
    if not response.is_success:
        return 'export-rejected'
    try:
        body = response.json()
        partial = body.get('partialSuccess', {})
        rejected = int(partial.get('rejectedDataPoints', 0))
        if rejected != 0:
            return 'export-rejected'
        return 'export-accepted-with-warning' if partial.get('errorMessage') else 'export-accepted'
    except (ValueError, TypeError, AttributeError):
        return 'export-unconfirmed'

async def record_context(duration_ms: float, outcome: str, step: str):
    if os.getenv('BODY_CONTEXT_TELEMETRY')!='1':return 'disabled'
    root=Path(__file__).resolve().parents[3];directory=root/'.logfire';credential=directory/'logfire_credentials.json'
    if directory.is_symlink() or credential.is_symlink():return 'unsafe-path'
    try:
        data=json.loads(credential.read_text())
        if data.get('project_url')!='https://logfire-eu.pydantic.dev/adinablazrx/starter-project' or data.get('logfire_api_url')!='https://logfire-eu.pydantic.dev':return 'target-mismatch'
        payload=context_metric_packet(duration_ms,outcome,step)
        async with httpx.AsyncClient(timeout=5,trust_env=False) as client:
            response=await client.post('https://logfire-eu.pydantic.dev/v1/metrics',headers={'Authorization':data['token']},json=payload)
            return metric_response_status(response)
    except Exception:return 'export-unavailable'
