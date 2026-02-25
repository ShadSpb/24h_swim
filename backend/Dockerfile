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
COPY auth.py ./
COPY competitions.py ./
COPY database.py ./
COPY lap_counts.py ./
COPY referees.py ./
COPY stats.py ./
COPY swim_sessions.py ./
COPY swimmers.py ./
COPY teams.py ./
COPY utils.py ./
COPY schema.sql ./

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SWIMTRACK_DB=/data/swimtrack.db \
    SWIMTRACK_HOST=0.0.0.0 \
    SWIMTRACK_PORT=5000

VOLUME ["/data"]
EXPOSE 5000

CMD ["python3", "app.py"]
