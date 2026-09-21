"""
FastAPI application entry point for SURI.
"""

from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_pool, close_pool
from backend.routes.auth_routes import router as auth_router
from backend.routes.session_routes import router as session_router
from backend.routes.diagnostic_routes import router as diagnostic_router
from backend.routes.content_routes import router as content_router
from backend.routes.practice_routes import router as practice_router
from backend.routes.progression_routes import router as progression_router
from backend.routes.student_routes import router as student_router
from backend.routes.graph_routes import router as graph_router
from backend.routes.quiz_routes import router as quiz_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database pool on startup and close it on shutdown."""
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="SURI API",
    description="Adaptive Mathematics Learning API for Philippine Junior High School",
    version="0.1.0",
    lifespan=lifespan,
)

# Add this to main.py, right after `app = FastAPI(...)` and before the
# CORS middleware. It logs how long each request took INSIDE your server —
# this tells you whether the slowness is server/DB-side, or somewhere
# between the browser and your server (network, proxy, cold start).

import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("timing")


@app.middleware("http")
async def log_request_time(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(f"{request.method} {request.url.path} → {duration_ms:.0f}ms")
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.0f}"
    return response


# How to use this:
# 1. Restart the server, hit the slow endpoints from the frontend.
# 2. Watch your server console. If it prints e.g. "GET /api/students/.../progress → 45ms",
#    the server did its job in 45ms — the 3-5s the USER experiences is happening
#    somewhere OUTSIDE this process (network, reverse proxy, frontend, cold start).
# 3. If it prints something like "→ 3200ms", the delay IS inside this process —
#    now check whether it's spent acquiring a DB connection or running queries
#    (add print(time.perf_counter()) around get_db()/conn.fetch() calls in the
#    specific route to narrow it down further).
# 4. Also try GET /api/graph/<any_valid_node_id>/chain — it does ZERO database
#    calls. If even this is slow according to the middleware log, the problem
#    isn't your queries at all, it's something in FastAPI/uvicorn startup,
#    middleware, or how the server is being run.
# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router)
app.include_router(session_router)
app.include_router(diagnostic_router)
app.include_router(content_router)
app.include_router(practice_router)
app.include_router(progression_router)
app.include_router(student_router)
app.include_router(graph_router)
app.include_router(quiz_router)


@app.get("/")
async def root():
    return {"message": "SURI API is running"}
