from fastapi import APIRouter, Depends, status

from app.api.deps import AIDep, AppSettings, CurrentStudent, DbSession, TeacherResponse
from app.rate_limit import limit_student
from app.schemas import AIInterventionOut, FollowUpOut, OverrideIn, ResponseDetail, ResponseIn, SubmitOut
from app.services.ai_features import generate_student_intervention
from app.services.diagnosis_store import override_diagnosis, submit_response
from app.services.results import response_detail

router = APIRouter(prefix="/api/responses", tags=["responses"])


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_student)])
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
    db.expire(response)  # reload every version, including any written concurrently
    return response_detail(response)


@router.post("/{response_id}/ai-intervention")
def get_ai_intervention(response: TeacherResponse, ai: AIDep) -> AIInterventionOut:
    """Generate 1-on-1 pedagogical desk intervention and conversational dialogue script."""
    return generate_student_intervention(response, ai)

