# ADR 0003: Competing Hypotheses Pipeline & Timing Facts

* **Status:** Accepted
* **Date:** 2026-10-16
* **Deciders:** Shane Christian (Track A), Madhav Thesiya (Track C), Meet Virugama (Track B)
* **Target Components:** `backend/app/services/pipeline.py`, `backend/app/services/guardrails.py`, `backend/app/ai/prompts.py`
* **Related Requirements:** Riddle 2 ("One Error, Several Stories"), System Invariant #6

---

## Context

When multiple students produce the exact same wrong answer, human evaluators and AI models routinely fall into **confirmation bias**: they latch onto the first plausible explanation that comes to mind.

For example, when three students answer `2/6` to `1/2 + 1/4`:
- Student 1 actually applied the flawed rule: *"Add across top and bottom: (1+1)/(2+4) = 2/6"* (**Misconception**).
- Student 2 knew the rule, found common denominator 4, wrote `2/4 + 1/4 = 3/4`, but made a silly writing slip at the very last step (**Slip**).
- Student 3 rushed to beat a timer, saw numbers, and pressed submit with 2 seconds left (**Ran out of time**).

Single-prompt AI graders typically output whatever story the LLM's stochastic decoder generates first. We required an architecture that scientifically weighs multiple competing hypotheses, grounds diagnoses in physical evidence, and avoids attributing student behavior to unsupported AI speculation.

---

## Decision

We implemented a **Bayesian-Style Competing Hypotheses Diagnostic Pipeline**:

1. **Mandatory Multi-Story Evaluation (`MIN_STORIES_WEIGHED`):**
   - For any incorrect response, the diagnostic engine is strictly required to formulate and compare at least **three distinct competing cognitive stories**:
     - `misconception` (flawed mental model or systematic invalid rule)
     - `slip` (careless arithmetic or transcription error despite correct understanding)
     - `misread` (overlooking a constraint, sign, or problem condition)
     - `guess` (self-reported or ungrounded guess)
     - `ran_out_of_time` (interrupted or rushed submission)
   - The AI must explicitly assign certainty scores ($0.0$ to $1.0$) to each candidate story and provide justification for the rejected candidates.

2. **Confidence Margin Requirement (`STORY_MARGIN`):**
   - The primary chosen story must lead the second-highest competing hypothesis by a strict margin:
     $$\text{Certainty}_{\text{top}} - \text{Certainty}_{\text{runner-up}} \ge 0.20$$
   - If the separation is less than $0.20$, or if the top story has certainty $< 0.70$, the pipeline rejects a premature verdict. Instead of guessing, it marks the diagnosis as ambiguous and initiates a Riddle 3 follow-up or defers to teacher review.

3. **Immutable Timing Facts vs. Speculation:**
   - The diagnosis `ran_out_of_time` is **strictly gated by code-measured server timestamps** (`time_spent_seconds` compared against quiz thresholds or student-confirmed timeout flags).
   - Under no circumstances is the LLM permitted to hallucinate or speculate that a student "seemed rushed" based solely on short or incomplete text.

4. **Verbatim Student Quote Verification:**
   - Any AI diagnosis asserting a misconception or slip must cite an exact verbatim substring from the student's submitted explanation (`quoted_evidence`).
   - The backend guardrail (`guardrails.py`) verifies that the quoted string is an authentic, case-insensitive substring of the raw explanation. Fabricated or paraphrased AI quotes cause immediate hypothesis rejection.

---

## Consequences

### Positive
- **Immunity to Single-Explanation Bias:** The system does not jump to the most common misconception when the student actually committed an arithmetic slip.
- **Evidence-Grounded Teacher Cockpit:** Teachers can review the exact evidence and the rejected alternatives, fostering trust in AI suggestions.
- **Physical Grounding:** Rushed work is tied to physical timestamps rather than probabilistic guesswork.

### Negative / Trade-offs
- **Higher LLM Token Footprint:** Prompts must solicit structured comparative rationales across multiple hypotheses, requiring ~500-800 tokens per analysis instead of a short 100-token classification.
- **Strict Guardrail Rejections:** If the LLM generates a paraphrased quote instead of an exact substring, the backend marks the interpretation as unconfirmed, requiring robust fallback handling.

---

## Alternatives Considered

1. **Single-Pass Greedy Classification:** Direct prompt: *"Classify the student's error as Misconception, Slip, or Misread."*
   - *Rejected:* Yields erratic classifications without evidentiary grounding; fails to quantify uncertainty between closely matched causes.
2. **Post-Hoc Explanations:** Having the LLM classify first, then ask it *"Why did you pick this over a slip?"*
   - *Rejected:* Produces post-hoc rationalizations rather than genuine comparative hypothesis testing.
