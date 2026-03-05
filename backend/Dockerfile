FROM python:3.12-slim

# System deps: fpcalc (Chromaprint), libsndfile (librosa), ffmpeg (audio decode)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libchromaprint-tools \
    libsndfile1 \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
COPY app ./app
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir ".[dev]"

COPY . .

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000
CMD ["/app/start.sh"]
