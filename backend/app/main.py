from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.errors import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.db.session import ballot_engine, election_engine, identity_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for graceful startup and shutdown."""
    # Startup: ensure logging and configuration validation
    yield
    # Shutdown: cleanly dispose all connection pools
    await identity_engine.dispose()
    await election_engine.dispose()
    await ballot_engine.dispose()


def create_app() -> FastAPI:
    """Factory creating and configuring the Pollwise FastAPI application."""
    app = FastAPI(
        title="Pollwise API",
        description="Secure Institutional Voting Platform API",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # Configure CORS strictly matching approved frontend origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
    )

    # Register centralized exception handlers for standard JSON envelopes
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Include main API router and dedicated ballot-box boundary router
    app.include_router(api_v1_router)
    from app.api.ballot_box import router as ballot_box_router
    app.include_router(ballot_box_router, prefix="/ballot-box/v1")

    @app.get("/")
    async def root():
        return {
            "name": "Pollwise API",
            "version": "0.1.0",
            "status": "operational",
            "docs": "/docs" if not settings.is_production else "disabled",
        }

    return app


app = create_app()
