# ADR 0002: Zero-PII Anonymous Student Sessions

* **Status:** Accepted
* **Date:** 2026-10-16
* **Deciders:** Shane Christian (Track A), Madhav Thesiya (Track C), Meet Virugama (Track B)
* **Target Components:** `backend/app/security.py`, `backend/app/models.py`, `backend/app/api/classrooms.py`, `frontend/src/pages/StudentQuiz.tsx`
* **Related Requirements:** COPPA / FERPA Compliance, Classroom Onboarding Latency, System Security Boundaries

---

## Context

In typical K-12 and university classroom environments, standard software onboarding introduces severe operational and legal friction:
1. **The Onboarding Time Sink:** In a 45-minute class period, requiring 30 students to create email accounts, verify links, set passwords, and manage forgotten credentials routinely consumes 15 to 20 minutes of instructional time.
2. **Regulatory & Privacy Liabilities:** The Children's Online Privacy Protection Act (COPPA), Family Educational Rights and Privacy Act (FERPA), and GDPR strictly govern the collection, retention, and third-party transmission of student Personally Identifiable Information (PII) such as full legal names, birth dates, student ID numbers, and email addresses.
3. **Third-Party AI Exposure Risk:** Sending personally identifiable student records alongside student reasoning data to external LLM providers (Google Gemini / Groq) introduces severe institutional compliance risks.

---

## Decision

We designed BehindTheMark with a **Zero-PII, Token-Based Anonymous Session Architecture**:

1. **No Student Registration or Passwords:**
   - Students join quizzes using an ephemeral 6-character classroom code (`join_code`) generated dynamically per quiz.
   - Students provide only a casual classroom nickname (e.g., "Asha", "Leo", "Alex").
   - No emails, passwords, student IDs, phone numbers, or account profiles are ever accepted, requested, or stored.

2. **Cryptographic Ephemeral Token Authentication:**
   - Joining a class generates an ephemeral high-entropy random token (`secrets.token_urlsafe(32)`).
   - The server stores only the SHA-256 hash of this token in `students.token_hash`.
   - The raw token is returned once to the student's browser and held in client storage/memory.
   - All subsequent student actions (`POST /api/submissions`, `POST /api/follow-ups/{id}/reply`) authenticate using `X-Student-Token`. Token comparisons use constant-time `hmac.compare_digest` to prevent timing attacks.

3. **In-Flight PII Redaction Before AI Transmission:**
   - Before any student explanation or follow-up reply is stored or forwarded to AI inference endpoints, a server-side regex redaction filter scrubs phone numbers, emails, and address patterns.
   - Even if a student accidentally types their phone number or email into the explanation box, it is sanitized before hitting the database or AI model.

4. **Teacher Ownership via Cryptographic Class Tokens:**
   - Teachers do not undergo complex institutional SSO setups for quick assessments. Creating a class generates a secure, secret teacher access token (`teacher_token`).
   - The teacher dashboard URL contains this token. It is hashed on the server, granting authoritative class control, real-time results viewing, and override capabilities.

---

## Consequences

### Positive
- **Instant Classroom Start:** A teacher can display a 6-letter code on the board; 30 students can be active and answering questions within 30 seconds.
- **Inherent Regulatory Compliance:** Storing zero student PII eliminates COPPA and FERPA compliance exposure by architectural guarantee.
- **Zero AI PII Leakage:** Third-party LLM providers only receive pedagogical reasoning content and nicknames, never identifiable student records.
- **Clean Database Hygiene:** Deleting a class cascades and completely purges all associated submissions, nicknames, and diagnoses without orphaned user accounts.

### Negative / Trade-offs
- **Session Continuity:** If a student clears their browser cache or switches devices mid-quiz, they cannot "log back in" to resume their nickname session unless the local token is preserved. (Mitigated by single-session quiz design).
- **Cross-Year Analytics:** Longitudinal tracking across semesters requires institutional integration (e.g., LMS LTI 1.3), which is planned for future enterprise adapters but deliberately omitted from the lightweight classroom core.

---

## Alternatives Considered

1. **OAuth2 / Google Workspace for Education SSO:**
   - *Rejected:* Requires district administrator approval, OAuth client configuration, consent screens, and domain whitelisting, preventing spontaneous use by individual teachers.
2. **Traditional Email/Password Accounts:**
   - *Rejected:* Creates massive operational burden (password reset requests during class) and substantial PII data breach liability.
