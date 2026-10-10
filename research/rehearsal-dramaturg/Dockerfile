FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY dramaturg ./dramaturg
USER 65534:65534
EXPOSE 8765
CMD [".venv/bin/uvicorn", "dramaturg.app:app", "--host", "0.0.0.0", "--port", "8765", "--no-access-log"]
