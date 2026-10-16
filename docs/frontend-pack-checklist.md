# Frontend Pack Checklist & Guide

The Frontend Pack is a required submission deliverable (typically hosted on a public Google Doc with "Anyone with the link can view"). It provides visual proof of real functionality across mobile and desktop views.

> **Crucial Rule:** Every screenshot must be from the live running app — **no mockups or figma designs**.

---

## Required Screenshot Inventory (8–12 Views)

| # | Screen View | Format | What to Capture | Sample Caption |
|---|---|---|---|---|
| 1 | **Landing Page** | Desktop / Tablet | Hero banner, "Try the sample class", "Create class", "Join as student" buttons. | *Landing page offering 1-click sample class and join options.* |
| 2 | **Quiz Builder** | Desktop | Question setup with prompt, correct answer, key idea, and multiple misconceptions with triggers and remedy hints. | *Teacher quiz builder configuring common misconceptions with trigger answers.* |
| 3 | **Student Question** | Mobile (360px viewport) | Question prompt, input field, explanation textarea, and confidence selector (`sure`, `unsure`, `guessed`). | *Mobile student interface capturing answer, reasoning explanation, and confidence rating.* |
| 4 | **Thinking / Loading State** | Mobile | "Reading your reasoning…" animated loader while dual AI-rule analysis executes. | *Transient loading state while the pipeline analyzes student reasoning against guardrails.* |
| 5 | **Follow-up Interaction** | Mobile | Targeted follow-up question asking the student to elaborate on ambiguous steps. | *Dynamic follow-up question triggered to discriminate between competing hypotheses.* |
| 6 | **Results Overview** | Desktop | "Same score, different reasons" breakdown grouping students with identical scores into distinct diagnostic clusters. | *Teacher results dashboard decomposing identical scores into Understood vs Misconception vs Slip.* |
| 7 | **Response Detail & Evidence** | Desktop / Tablet | Modal or expanded row showing the student's raw text alongside model hypotheses and verbatim quoted evidence. | *Response detail view displaying verbatim quotes supporting each candidate hypothesis.* |
| 8 | **"Why This Label?" Trace** | Desktop | Full execution trace table showing normalization, rule match, guardrail checks, and latency. | *Transparent audit log detailing the decision pipeline from input to settled verdict.* |
| 9 | **Teacher Override Control** | Desktop | Teacher selecting a revised diagnostic label with override audit trail preserved. | *Teacher overriding diagnostic label; writes versioned record without deleting raw evidence.* |
| 10 | **Fallback / AI Unavailable** | Desktop / Mobile | Banner indicating "AI unavailable — rule-based only" when running in offline or rate-limited mode. | *Resilient fallback state operating under deterministic rule matching during API outages.* |
| 11 | **Empty States** | Desktop / Mobile | "No responses yet — share code ABC123" and "No misconceptions added". | *Clear empty state providing actionable onboarding instructions.* |

---

## Assembly Instructions
1. Capture screenshots at 2x resolution using browser devtools (Command/Ctrl + Shift + P → "Capture full size screenshot" or "Capture screenshot").
2. Paste sequentially into a Google Doc formatted with clean 1-line bold captions directly beneath each image.
3. Set document sharing permissions to **"Anyone with the link can view"**.
4. Paste the public link into `README.md`.
