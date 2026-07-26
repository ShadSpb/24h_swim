FROM python:3.12-slim

WORKDIR /app

# Needed by docker-compose healthcheck command.
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy only runtime sources (avoid shipping local DB files/tests in the image).
COPY app.py ./
COPY authz.py ./
COPY auth.py ./
COPY competitions.py ./
COPY database.py ./
COPY email_service.py ./
COPY lap_counts.py ./
COPY referees.py ./
COPY response_cache.py ./
COPY stats.py ./
COPY swim_sessions.py ./
COPY swimmers.py ./
COPY teams.py ./
COPY utils.py ./
COPY feedback.py ./
COPY schema.sql ./

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SWIMTRACK_DB=/data/swimtrack.db \
    SWIMTRACK_HOST=0.0.0.0 \
    SWIMTRACK_PORT=5000

VOLUME ["/data"]
EXPOSE 5000

# Serve with gunicorn (multi-worker) instead of the single-process Werkzeug dev
# server so many concurrent Live View clients don't queue behind one process.
# Binds the same host:port so nginx keeps proxying unchanged. `exec` makes
# gunicorn PID 1 so it receives SIGTERM for graceful shutdown. `--preload`
# builds the app (and runs DB init/migrations) once in the master before
# forking, avoiding a startup migration race across workers.
# NOTE: the in-process response cache and rate limiter (app.py/authz.py) are
# now per-worker; that's fine (each still caches; rate limits scale by workers).
CMD ["sh", "-c", "exec gunicorn --preload --factory 'app:create_app' -b ${SWIMTRACK_HOST:-0.0.0.0}:${SWIMTRACK_PORT:-5000} --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-8} --worker-class gthread --timeout ${GUNICORN_TIMEOUT:-60} --access-logfile - --error-logfile -"]
