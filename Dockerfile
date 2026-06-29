# EduAgent Backend — Production Dockerfile
# Dual DB: uses PostgreSQL (DATABASE_URL) when set, otherwise SQLite.
# Secrets injected as env vars — never copy .env here.

FROM python:3.12-slim

WORKDIR /app

# Install system deps for audio processing + PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy application code (NOT .env — secrets come from Render env vars)
COPY backend/ /app/backend/

# Expose port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with 2 workers (fits Render 512MB free tier)
CMD ["gunicorn", "backend.main:app", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "--max-requests", "10000", "--max-requests-jitter", "1000"]
