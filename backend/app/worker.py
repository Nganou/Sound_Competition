import ssl
from celery import Celery
from app.config import settings

celery_app = Celery(
    "resono",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

_ssl_conf: dict = {}
if settings.celery_broker_url.startswith("rediss://"):
    _ssl_conf = {
        "broker_use_ssl": {"ssl_cert_reqs": ssl.CERT_NONE},
        "redis_backend_use_ssl": {"ssl_cert_reqs": ssl.CERT_NONE},
    }

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    **_ssl_conf,
)
