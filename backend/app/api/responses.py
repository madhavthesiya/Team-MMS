from fastapi import APIRouter, Depends, status

from app.api.deps import AIDep, AppSettings, CurrentStudent, DbSession, TeacherResponse
from app.rate_limit import rate_limited
from app.schemas import FollowUpOut, OverrideIn, ResponseDetail, ResponseIn, SubmitOut
from app.services.diagnosis_store import override_diagnosis, submit_response
from app.services.results import response_detail

router = APIRouter(prefix="/api/responses", tags=["responses"])


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limited)])
def submit(body: ResponseIn, student: CurrentStudent, db: DbSession, ai: AIDep, settings: AppSettings) -> SubmitOut:
    """Student submits an answer. The response never includes correctness or a label."""
    response, follow_up = submit_response(db, student, body, ai, settings)
    db.commit()
    return SubmitOut(
        response_id=response.id,
        follow_up=FollowUpOut(follow_up_id=follow_up.id, question_text=follow_up.question_text) if follow_up else None,
    )


@router.get("/{response_id}")
def get_response(response: TeacherResponse) -> ResponseDetail:
    return response_detail(response)


@router.post("/{response_id}/override")
def override(body: OverrideIn, response: TeacherResponse, db: DbSession) -> ResponseDetail:
    override_diagnosis(db, response, body)
    db.commit()
    return response_detail(response)
