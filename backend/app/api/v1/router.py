from fastapi import APIRouter

from app.api.ballot_box import router as ballot_box_router
from app.api.v1.auth import router as auth_router
from app.api.v1.auth import users_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.elections import router as elections_router
from app.api.v1.eligibility import router as eligibility_router
from app.api.v1.health import router as health_router
from app.api.v1.invitations import router as invitations_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.reports import router as reports_router
from app.api.v1.results import router as results_router
from app.api.v1.voter_admin import router as voter_admin_router
from app.api.v1.voter_auth import router as voter_auth_router
from app.api.v1.voter_ballot import router as voter_ballot_router
from app.api.v1.voting_centres import router as voting_centres_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(invitations_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(elections_router)
api_v1_router.include_router(eligibility_router)
api_v1_router.include_router(results_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(ballot_box_router)
api_v1_router.include_router(voter_admin_router)
api_v1_router.include_router(voter_auth_router)
api_v1_router.include_router(voter_ballot_router)
api_v1_router.include_router(voting_centres_router)
