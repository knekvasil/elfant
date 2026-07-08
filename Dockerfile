FROM python:3.14-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml .
RUN uv pip install --system --no-cache . nflreadpy

COPY elfant/ elfant/
COPY alembic.ini .
COPY alembic/ alembic/
COPY frontend/dist frontend/dist/

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
EXPOSE 8008
CMD ["python3", "-m", "uvicorn", "elfant.web:app", "--host", "0.0.0.0", "--port", "8008"]
