import asyncio
import os
import time
from contextlib import suppress
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import ValidationError
from .models import Request, Result
from .telemetry import record_run, record_context
from .workflow import Workflow, LocalOllamaAdapter

ORIGINS = {"http://localhost:3000", "http://127.0.0.1:3000"}
app = FastAPI(title="The Rehearsal Dramaturg", version="0.1.0")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
app.add_middleware(CORSMiddleware, allow_origins=sorted(ORIGINS), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
class ObservedWorkflow(Workflow):
    async def run(self, request, progress):
        started = time.monotonic()
        outcome = "success"
        try:
            return await super().run(request, progress)
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        except Exception:
            outcome = "failure"
            raise
        finally:
            await record_run((time.monotonic() - started) * 1000, outcome)

workflow = ObservedWorkflow(LocalOllamaAdapter(os.environ["DRAMATURG_OLLAMA_MODEL"]) if os.getenv("DRAMATURG_OLLAMA_MODEL") else None)

@app.get("/health")
async def health():
    return {"status": "ok", "model": workflow.adapter.name, "fictional_only": True}

@app.post("/scores", response_model=Result)
async def scores(request: Request):
    async def progress(stage):
        pass
    try:
        return await workflow.run(request, progress)
    except TimeoutError:
        raise HTTPException(504, "Composition timed out") from None
    except Exception:
        raise HTTPException(422, "Composition failed validation; no proposal activated") from None

@app.websocket("/rehearse")
async def rehearse(socket: WebSocket):
    if socket.headers.get("origin") not in ORIGINS:
        await socket.close(code=1008)
        return
    await socket.accept()
    task = None
    listener = None
    async def progress(stage):
        await socket.send_json({"type": "progress", "stage": stage})
    try:
        message = await asyncio.wait_for(socket.receive_text(), timeout=10)
        if len(message) > 2048:
            raise ValueError("Request too large")
        request = Request.model_validate_json(message)
        task = asyncio.create_task(workflow.run(request, progress))
        listener = asyncio.create_task(socket.receive_text())
        done, _ = await asyncio.wait([task, listener], return_when=asyncio.FIRST_COMPLETED)
        if listener in done:
            # Any follow-up message or disconnect cancels this one-shot rehearsal.
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            await socket.send_json({"type": "cancelled"})
        else:
            result = task.result()
            await socket.send_json({"type": "result", "result": result.model_dump()})
    except (WebSocketDisconnect, RuntimeError):
        pass
    except (ValueError, ValidationError):
        await socket.send_json({"type": "error", "message": "Invalid request or unsupported proposal; nothing activated."})
    except TimeoutError:
        await socket.send_json({"type": "error", "message": "Composition timed out; nothing activated."})
    except Exception:
        await socket.send_json({"type": "error", "message": "Composer unavailable; nothing activated."})
    finally:
        for pending in (task, listener):
            if pending:
                pending.cancel()
                with suppress(asyncio.CancelledError, Exception):
                    await pending
        with suppress(RuntimeError):
            await socket.close()

# Selected packets only. No persistent Python store, generic instrumentation or input logs.
from pathlib import Path
from hmac import compare_digest
from fastapi import Request as HttpRequest
from fastapi.responses import JSONResponse
from .context.models import Packet
from .context.engine import process as process_context
@app.post('/context/process')
async def context_process(request: HttpRequest):
    token_path = Path(__file__).resolve().parents[3] / 'private-data/context-service/token'
    if not token_path.is_file() or not compare_digest(request.headers.get('authorization',''), 'Bearer '+token_path.read_text()):
        return JSONResponse({'error':'authentication_required'},status_code=401)
    raw=bytearray()
    async for chunk in request.stream():
        if len(raw)+len(chunk)>1_000_000:return JSONResponse({'error':'packet_limit'},status_code=413)
        raw.extend(chunk)
    started=time.monotonic();outcome='failure';step='validation'
    try:
        packet=Packet.model_validate_json(raw)
        step='author' if packet.command.action=='decide' else 'replay'
        if packet.state and any(o.acquisition!='simulated' for o in packet.state.observations):
            raise ValueError('sandbox_only')
        result=await process_context(packet)
        outcome='success'
        return JSONResponse(result.model_dump(mode='json'))
    except ValidationError:
        return JSONResponse({'error':'invalid_packet'},status_code=422)
    except ValueError:
        return JSONResponse({'error':'revision_or_evidence_changed'},status_code=409)
    except Exception:
        return JSONResponse({'error':'processing_unavailable'},status_code=503)
    finally:
        await record_context((time.monotonic()-started)*1000,outcome,step)
