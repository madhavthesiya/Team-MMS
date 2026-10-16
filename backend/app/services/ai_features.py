"""AI Features service for BehindTheMark.

Powers:
1. Real-time 1-on-1 pedagogical desk intervention and dialogue script for a student.
2. Conceptual diagnostic question generator with researched misconceptions and signals.
3. Whole-class cognitive executive synthesis and 10-minute warm-up reteach plan.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import AIClient, AIUnavailable
from app.ai.prompts import (
    build_class_summary_prompt,
    build_intervention_prompt,
    build_question_gen_prompt,
)
from app.ai.schemas import AIRawClassSummary, AIRawIntervention, AIRawQuestion
from app.models import ClassRoom, Misconception, Question, Response, Student
from app.schemas import (
    AIGenerateQuestionIn,
    AIGenerateQuestionOut,
    AIInterventionOut,
    AIMisconceptionDraft,
    AISummaryOut,
    DifferentiatedGroup,
    ScriptTurn,
)
from app.services.normalizer import answers_match


def generate_student_intervention(response: Response, ai: AIClient) -> AIInterventionOut:
    diag = response.current_diagnosis
    diag_label = diag.label if diag else "not_sure"
    
    misc_label = None
    misc_signal = None
    misc_remedy = None
    if diag and diag.misconception_id:
        for m in response.question.misconceptions:
            if m.id == diag.misconception_id:
                misc_label = m.label
                misc_signal = m.signal_text
                misc_remedy = m.remedy_hint
                break

    followup_reply = None
    for d in reversed(response.diagnoses):
        if d.follow_up and d.follow_up.student_reply:
            followup_reply = d.follow_up.student_reply
            break

    prompt = build_intervention_prompt(
        question_prompt=response.question.prompt,
        correct_answer=response.question.correct_answer,
        key_idea=response.question.key_idea,
        student_answer=response.answer_raw,
        student_explanation=response.explanation_raw,
        follow_up_reply=followup_reply,
        diagnosed_label=diag_label,
        misconception_label=misc_label,
        signal_text=misc_signal,
        remedy_hint=misc_remedy,
        is_correct=response.is_correct,
    )

    try:
        raw_json = ai.generate_json(prompt, AIRawIntervention, timeout_seconds=25.0)
        parsed = AIRawIntervention.model_validate_json(raw_json)
        return AIInterventionOut(
            student_nickname=response.student.nickname,
            diagnosed_label=diag_label,
            misconception_name=misc_label,
            misconception_breakdown=parsed.misconception_breakdown,
            one_on_one_script=[
                ScriptTurn(
                    teacher_prompt=turn.teacher_prompt,
                    anticipated_student_thinking=turn.anticipated_student_thinking,
                )
                for turn in parsed.one_on_one_script
            ],
            concrete_counterexample=parsed.concrete_counterexample,
            check_for_understanding_question=parsed.check_for_understanding_question,
            generated_by_model=ai.model,
        )
    except (AIUnavailable, Exception):
        # Graceful rule-informed fallback
        fallback_breakdown = (
            f"The student showed evidence of '{misc_label or diag_label}'. "
            f"Their reasoning indicates: {misc_remedy or 'they need to articulate the underlying mechanism rather than pattern-matching.'}"
        )
        return AIInterventionOut(
            student_nickname=response.student.nickname,
            diagnosed_label=diag_label,
            misconception_name=misc_label,
            misconception_breakdown=fallback_breakdown,
            one_on_one_script=[
                ScriptTurn(
                    teacher_prompt=f"Walk me through your thinking when you got '{response.answer_raw}'. What was your first step?",
                    anticipated_student_thinking="Explains their rule or calculation method.",
                ),
                ScriptTurn(
                    teacher_prompt=f"How does that connect with the key principle: '{response.question.key_idea}'?",
                    anticipated_student_thinking="Recognizes where the assumption diverges from the core concept.",
                ),
            ],
            concrete_counterexample=f"Consider a simpler case where {response.question.correct_answer} is known directly: what would happen if the conditions doubled?",
            check_for_understanding_question=f"Can you explain in your own words why '{response.question.correct_answer}' satisfies {response.question.key_idea}?",
            generated_by_model="rule_fallback",
        )


def generate_ai_question(body: AIGenerateQuestionIn, ai: AIClient) -> AIGenerateQuestionOut:
    prompt = build_question_gen_prompt(
        topic=body.topic,
        grade_level=body.grade_level,
        misconception_focus=body.misconception_focus,
    )
    try:
        raw_json = ai.generate_json(prompt, AIRawQuestion, timeout_seconds=25.0)
        parsed = AIRawQuestion.model_validate_json(raw_json)
        answer_type = parsed.answer_type if parsed.answer_type in ("number", "text", "choice") else "text"
        correct_ans = parsed.correct_answer.strip()
        choices = [c.strip() for c in parsed.choices if c.strip()]

        if answer_type == "choice":
            if not any(answers_match(correct_ans, c, "choice") for c in choices):
                choices.insert(0, correct_ans)
            while len(choices) < 2:
                choices.append("Other")

        sanitized_misconceptions: list[AIMisconceptionDraft] = []
        for m in parsed.misconceptions:
            # Filter out any trigger that accidentally matches the correct answer
            clean_triggers = [
                t.strip()
                for t in m.trigger_answers
                if t.strip() and not answers_match(t.strip(), correct_ans, answer_type)
            ]
            sanitized_misconceptions.append(
                AIMisconceptionDraft(
                    label=m.label.strip(),
                    trigger_answers=clean_triggers,
                    signal_text=m.signal_text.strip(),
                    remedy_hint=m.remedy_hint.strip(),
                )
            )

        return AIGenerateQuestionOut(
            prompt=parsed.prompt.strip(),
            correct_answer=correct_ans,
            answer_type=answer_type,
            key_idea=parsed.key_idea.strip(),
            choices=choices,
            misconceptions=sanitized_misconceptions,
            time_limit_seconds=parsed.time_limit_seconds or 90,
        )
    except (AIUnavailable, Exception):
        # Fallback starter template
        return AIGenerateQuestionOut(
            prompt=f"Explain the core concept of {body.topic} and solve for the outcome in a standard case.",
            correct_answer="See solution guide",
            answer_type="text",
            key_idea=f"Demonstrates fundamental understanding of {body.topic}",
            choices=[],
            misconceptions=[
                AIMisconceptionDraft(
                    label=f"Common confusion in {body.topic}",
                    trigger_answers=["0", "N/A"],
                    signal_text="inverted relation or missed variable",
                    remedy_hint="Highlight the inverse relationship directly with a counterexample.",
                )
            ],
            time_limit_seconds=90,
        )


def generate_class_ai_summary(db: Session, classroom: ClassRoom, ai: AIClient) -> AISummaryOut:
    responses = db.scalars(
        select(Response)
        .join(Student, Response.student_id == Student.id)
        .where(Student.class_id == classroom.id)
    ).all()

    total = len(responses)
    topic = classroom.quiz.topic if classroom.quiz else "Quiz"

    # Fast-path for zero submissions
    if total == 0:
        return AISummaryOut(
            class_name=classroom.name,
            quiz_topic=topic,
            total_students=0,
            correct_count=0,
            accuracy_percentage=0.0,
            executive_summary=(
                f"No student responses have been submitted yet for the '{topic}' diagnostic quiz in '{classroom.name}'. "
                f"Invite students to join using code '{classroom.join_code}'. Once responses arrive, this dashboard will "
                f"synthesize conceptual mastery, uncover cognitive misconceptions, and build a 10-minute reteach plan."
            ),
            dominant_misconception="Awaiting student submissions",
            undercover_guessers_warning="No data yet. Undercover guessers (Riddle 1) will be flagged once explanations are received.",
            ten_minute_reteach_plan=[
                "Step 1: Have students join the class and submit their initial answers with explanations.",
                "Step 2: Check for any pending follow-up questions to resolve competing cognitive stories.",
                "Step 3: Re-run this executive synthesis once responses are in."
            ],
            differentiated_groups=[],
            generated_by_model="system",
        )

    correct_count = sum(1 for r in responses if r.is_correct)
    pct = (correct_count / total * 100.0) if total > 0 else 0.0

    topic = classroom.quiz.topic if classroom.quiz else "Quiz"

    # Compile summaries
    summary_lines = []
    labels_count: dict[str, int] = {}
    for r in responses:
        diag = r.current_diagnosis
        lbl = diag.label if diag else ("understood" if r.is_correct else "not_sure")
        labels_count[lbl] = labels_count.get(lbl, 0) + 1
        fu_text = ""
        for d in reversed(r.diagnoses):
            if d.follow_up and d.follow_up.student_reply:
                fu_text = f" | Follow-up reply: '{d.follow_up.student_reply[:60]}'"
                break
        summary_lines.append(
            f"- Student '{r.student.nickname}': answer='{r.answer_raw}', correct={r.is_correct}, "
            f"story={lbl}, expl='{r.explanation_raw[:80]}'{fu_text}"
        )

    diagnoses_summary = "\n".join(summary_lines) if summary_lines else "- (No student submissions yet)"

    prompt = build_class_summary_prompt(
        class_name=classroom.name,
        quiz_topic=topic,
        total_students=total,
        correct_count=correct_count,
        accuracy_pct=pct,
        diagnoses_summary=diagnoses_summary,
    )

    try:
        raw_json = ai.generate_json(prompt, AIRawClassSummary, timeout_seconds=28.0)
        parsed = AIRawClassSummary.model_validate_json(raw_json)
        return AISummaryOut(
            class_name=classroom.name,
            quiz_topic=topic,
            total_students=total,
            correct_count=correct_count,
            accuracy_percentage=round(pct, 1),
            executive_summary=parsed.executive_summary,
            dominant_misconception=parsed.dominant_misconception,
            undercover_guessers_warning=parsed.undercover_guessers_warning,
            ten_minute_reteach_plan=parsed.ten_minute_reteach_plan,
            differentiated_groups=[
                DifferentiatedGroup(
                    group_name=g.group_name,
                    focus_story=g.focus_story,
                    student_count=g.student_count,
                    student_nicknames=g.student_nicknames,
                    suggested_action=g.suggested_action,
                )
                for g in parsed.differentiated_groups
            ],
            generated_by_model=ai.model,
        )
    except (AIUnavailable, Exception):
        # Fallback synthesis
        dominant = max(labels_count.items(), key=lambda kv: kv[1])[0] if labels_count else "None observed"
        return AISummaryOut(
            class_name=classroom.name,
            quiz_topic=topic,
            total_students=total,
            correct_count=correct_count,
            accuracy_percentage=round(pct, 1),
            executive_summary=(
                f"Class '{classroom.name}' completed the diagnostic assessment on '{topic}' with a raw accuracy of {pct:.1f}% "
                f"across {total} responses. The diagnostic engine revealed that accuracy alone does not tell the full story, "
                f"with distinct cognitive clusters separating conceptual understanding from formulaic guessing."
            ),
            dominant_misconception=f"Most frequent pattern: {dominant}",
            undercover_guessers_warning="Inspect students with correct answers and low certainty scores for possible lucky guessing.",
            ten_minute_reteach_plan=[
                "Warm-up (3 min): Display a contrastive student answer pair side-by-side on the board.",
                "Guided Investigation (4 min): Have students debate which explanation reveals the underlying mechanism.",
                "Exit Ticket (3 min): Ask students to solve a modified version where rote tricks fail.",
            ],
            differentiated_groups=[
                DifferentiatedGroup(
                    group_name="Needs Conceptual Grounding",
                    focus_story=dominant,
                    student_count=total - correct_count,
                    student_nicknames=[],
                    suggested_action="Use concrete visual counterexample before introducing more practice problems.",
                ),
                DifferentiatedGroup(
                    group_name="Conceptually Secure",
                    focus_story="understood",
                    student_count=correct_count,
                    student_nicknames=[],
                    suggested_action="Extend with multi-step transfer problems.",
                ),
            ],
            generated_by_model="rule_fallback",
        )
