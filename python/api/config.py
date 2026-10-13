"""Configuration settings for the FATHOM FastAPI backend."""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = "postgresql://localhost:5432/fathom"
    REDIS_URL: str = "redis://localhost:6379"
    NODE_BACKEND_URL: str = "http://localhost:3000"
    PORT: int = 8000
    DEBUG: bool = False
    # SEC-010: Restrict CORS to specific origins — never use wildcard in production
    CORS_ORIGINS: list[str] = (
        ["http://localhost:5173", "http://localhost:3000"]
        if os.getenv("NODE_ENV") != "production"
        else [o for o in [os.getenv("FRONTEND_URL"), os.getenv("CORS_ORIGIN")] if o]
    ) or ["http://localhost:5173"]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
