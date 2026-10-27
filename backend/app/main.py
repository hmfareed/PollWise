from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
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

    # Security headers and anti-caching middleware
    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self' http://localhost:* ws://localhost:*; "
            "frame-ancestors 'none';"
        )
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # Anti-caching headers on auth and credential/ballot endpoints
        path = request.url.path
        if path.startswith(("/api/v1/auth", "/ballot-box")) or path.endswith("/voting-credential"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"

        return response

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
