"""FastAPI application for FATHOM database monitoring backend."""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .routes import analytics, ml

logger = logging.getLogger(__name__)


class HealthCheckResponse(BaseModel):
    """Response model for health check endpoint."""

    status: str
    version: str
    debug: bool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    logger.info("Starting FATHOM FastAPI backend")
    logger.info(f"Database URL: {settings.DATABASE_URL}")
    logger.info(f"Node backend URL: {settings.NODE_BACKEND_URL}")
    yield
    # Shutdown
    logger.info("Shutting down FATHOM FastAPI backend")


app = FastAPI(
    title="FATHOM Analytics API",
    description="Analytics, ML, and data processing APIs for database monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analytics.router)
app.include_router(ml.router)


@app.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """
    Health check endpoint for service monitoring.

    Returns:
        Health status and service information
    """
    return HealthCheckResponse(
        status="healthy",
        version="1.0.0",
        debug=settings.DEBUG,
    )


@app.get("/")
async def root():
    """
    Root endpoint with API information.

    Returns:
        API information and available endpoints
    """
    return {
        "name": "FATHOM Analytics API",
        "version": "1.0.0",
        "description": "Analytics, ML, and data processing backend for database monitoring",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "analytics": "/api/analytics",
            "ml": "/api/ml",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )
