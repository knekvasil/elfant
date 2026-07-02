FROM python:3.12-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --default-timeout=120 . nflreadpy

COPY elfant/ elfant/
COPY frontend/dist frontend/dist/

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
EXPOSE 8008
CMD ["python3", "-m", "uvicorn", "elfant.web:app", "--host", "0.0.0.0", "--port", "8008"]
