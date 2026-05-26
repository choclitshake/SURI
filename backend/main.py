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
