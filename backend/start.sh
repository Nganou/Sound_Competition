#!/bin/bash
# Start Celery worker in the background, then start uvicorn in the foreground
celery -A app.worker worker --loglevel=info --concurrency=2 &
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
