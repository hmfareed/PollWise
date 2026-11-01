from fastapi import APIRouter

from app.api.ballot_box import router as ballot_box_router
from app.api.v1.auth import router as auth_router, users_router
from app.api.v1.elections import router as elections_router
from app.api.v1.eligibility import router as eligibility_router
from app.api.v1.health import router as health_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.results import router as results_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(elections_router)
api_v1_router.include_router(eligibility_router)
api_v1_router.include_router(results_router)
api_v1_router.include_router(ballot_box_router)
