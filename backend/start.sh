#!/bin/bash
set -e

# Run database migrations before starting services
alembic upgrade head

# Start Celery worker in the background (solo pool = single process, minimal RAM),
# then start uvicorn in the foreground on the port Render assigns.
celery -A app.worker worker --loglevel=info --pool=solo &
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
