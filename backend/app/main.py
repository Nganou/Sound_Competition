from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api.v1.router import api_router


limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connectivity (non-fatal — don't crash the server if DB
    # isn't reachable yet; individual requests will fail with a clear error instead)
    from app.db.base import engine
    try:
        async with engine.begin():
            pass
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] Warning: DB connectivity check failed — {exc}")

    # Seed demo data if DEMO_MODE=true (idempotent — safe to run every startup)
    if settings.demo_mode:
        try:
            from app.db.seed import run_seed
            await run_seed()
        except Exception as exc:  # noqa: BLE001
            # Never crash the server if seeding fails (e.g. migration not yet run)
            print(f"[seed] Warning: demo seed failed — {exc}")

    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="Resono API",
    description="Swiss-system beat battle platform for sound engineers.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    redirect_slashes=False,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "env": settings.app_env, "demo": settings.demo_mode}
