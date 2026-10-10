# The Rehearsal Dramaturg

A fictional installation composer beside Storywalker's XR lab. Three synthetic oscillator fragments become three proposed spatial scores. Author review, cue acceptance, activation and sound playback are separate actions. No Vault sources or personal scene inputs are supported by the service.

## Run locally

From the repository root:

```sh
uv sync --project research/rehearsal-dramaturg --frozen
uv run --project research/rehearsal-dramaturg uvicorn dramaturg.app:app --app-dir research/rehearsal-dramaturg --host 127.0.0.1 --port 8765 --no-access-log
```

In another terminal, run `npm run dev` and open `http://localhost:3000/research/xr`. Port 3000 is the explicit allowed browser origin. The service exposes `/health`, `/docs`, `POST /scores` and the one-shot WebSocket `/rehearse`.

Enter a fictional direction, propose three scores, inspect the synthetic source basis, accept a proposal and load it into rehearsal. Accept individual cues in the XR lab, activate the accepted score, then enable spatial sound. The score's start offsets and durations are scheduled from that sound action; cues outside the listener's range or time budget remain inaudible. Leaving/hiding the page stops audio. Refusing or revising a proposal does not activate anything. Generate fresh scores after changing direction. Each generation gets new identities so earlier acceptance cannot authorize a revision.

Download proposals and review history before leaving. Restore accepts only the bounded dramaturg review format and never restores activation. History includes earlier refused proposals; this is a local download, not server persistence. Scene exports use the existing XR format; the separate dramaturg review preserves the timing score and proposal history.

## What is implemented

- Python/Pydantic contracts; asynchronous FastAPI REST and WebSocket interfaces.
- LangChain Core `RunnableLambda` for deterministic catalogue retrieval by exact direction tags. No embeddings or LLM retrieval claims.
- A deterministic mock composer, source verification, finite spatial bounds and a two-minute timing envelope.
- At most two concurrent compositions with a 25-second timeout, request bounds and cancellation on follow-up/disconnect.
- Tests for model fabrication, timing, bounds, missing catalogue, concurrency, cancellation and API/WebSocket responses; frontend tests for refused-history round trips and safe scene loading.
- No application-wide instrumentation, transcript collection, automatic host monitoring or cloud deployment.

This is a bounded workflow, not an autonomous agent with unrestricted tools. The template mock varies ordering/layout; it does not understand the emotional meaning of a direction.

## Optional local LLM

Install/start Ollama separately and pull an appropriate model. Start the service with `DRAMATURG_OLLAMA_MODEL=<installed-model-name>` using the same command above. Only `http://127.0.0.1:11434` is contacted for inference. The adapter sends the typed direction and synthetic catalogue to that local process, requests the result contract, and rejects unsupported source facts. Do not enter private material into this experimental panel. Hosted inference is not configured. LangChain/LangSmith tracing is explicitly disabled even if enabled in the surrounding shell.

Actual local inference requires an installed model and has not been validated as part of the mock setup. Malformed responses are rejected rather than converted into Author decisions.

## Optional Logfire metrics

Set `DRAMATURG_TELEMETRY=1` when starting the Python service to opt in. The exporter reads the existing ignored `.logfire/logfire_credentials.json` in this repository, rejects symlink credentials or a mismatched target, and uses its send-only token without printing or copying it.

Exact target: `https://logfire-eu.pydantic.dev/adinablazrx/starter-project`.

The complete outbound allowlist is a duration in milliseconds, outcome (`success`, `failure`, `cancelled`), a fixed service name (`storywalker-rehearsal-dramaturg`), a fixed local-fictional environment and the measurement timestamp. Prompts, source text, scenes, exception messages, hostnames and user identifiers are omitted. No background collection occurs. Export failure never changes a proposal or approval. Auto-instrumentation is deliberately absent.

## Tests and container

```sh
uv run --project research/rehearsal-dramaturg pytest research/rehearsal-dramaturg/tests -q
npx vitest run lib/rehearsal-dramaturg.test.ts lib/xr-scene.test.ts
npm run typecheck
```

```sh
docker build -t storywalker-dramaturg research/rehearsal-dramaturg
docker run --rm -p 127.0.0.1:8765:8765 storywalker-dramaturg
```

The Linux container runs as an unprivileged user and installs from `uv.lock`. Docker is not installed on the development Mac, so the image build/runtime remains unverified. Container inference and telemetry are not preconfigured; local Ollama and repository credentials are intentionally absent from the image.

## Career evidence

This exercise develops idiomatic Python, Pydantic validation, asyncio, REST, WebSockets, mocks and maintainable tests, package environments, a LangChain retrieval component, Docker packaging and a Next.js interaction surface. The optional local model adapter supplies an LLM integration boundary. Cloud deployment, real-model evaluation and production-scale operations remain further work; a prototype does not establish senior-level professional experience.
