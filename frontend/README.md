# BehindTheMark — Frontend Client

The frontend for **BehindTheMark** is a responsive single-page application built with React, TypeScript, Vite, and Tailwind CSS. It delivers a studio-grade Google Classroom workspace UX for teachers and an intuitive, zero-PII diagnostic assessment experience for students.

---

## 1. Directory Structure & Key Modules

```text
frontend/
├── src/
│   ├── api/             # Typed API client and contract interfaces
│   │   ├── client.ts    # Centralized HTTP request client with VITE_API_URL support
│   │   └── types.ts     # TypeScript interfaces matching API contract v1.5
│   ├── components/      # Reusable UI primitives and domain widgets
│   │   ├── ui/          # Accessible primitives (Button, Input, Textarea, Modal, Tabs)
│   │   ├── CardNav.tsx  # Dynamic header navigation with animated hover cards
│   │   ├── ClassNav.tsx # Google Classroom-inspired tab navigation (Stream, Classwork, Results)
│   │   ├── TransferPanel.tsx # Riddle 4 transfer item viewer and recheck scheduler
│   │   ├── RecheckCard.tsx   # Riddle 4 student unaided transfer card
│   │   └── SwarmCursor.tsx   # Ambient canvas background telemetry
│   ├── lib/             # Utilities and browser persistence
│   │   ├── storage.ts   # LocalStorage with in-memory fallback for private browsing
│   │   ├── labels.ts    # Diagnostic label mappings and human-readable badges
│   │   └── useTeacherToken.ts # Token retrieval from URL hash with local cache
│   └── pages/           # Application views
│       ├── Landing.tsx  # Interactive concept explainer (Asha vs Leo duality)
│       ├── student/     # Student portal
│       │   ├── Join.tsx # Anonymous class code & nickname entry
│       │   └── Quiz.tsx # Question answering, explanation box, confidence rating, Riddle 3 follow-ups
│       └── teacher/     # Teacher Cockpit
│           ├── CreateClass.tsx   # Class creation with 5 subject templates
│           ├── ClassHome.tsx     # Stream view, projector mode, join code sharing
│           ├── QuizBuilder.tsx   # Question editor + AI Diagnostic Question Generator
│           ├── Results.tsx       # Cognitive clustering + AI Class Executive Synthesis + Riddle 4 Panel
│           └── ResponseDetail.tsx# Evidence trace, Riddle 2 hypotheses, Riddle 3 audit, AI 1-on-1 Dialogue Script
```

---

## 2. Architectural Invariants in the Frontend

1. **Zero Personal Identifiable Information (PII):** The student join flow requires only a 6-letter join code and an ephemeral nickname. No emails, passwords, or personal profiles are collected or stored.
2. **Deterministic Grading Separation:** The frontend never computes or infers correctness scores. Answer evaluation is performed exclusively by the backend code.
3. **Private-Browsing Resilience:** In restricted school environments (e.g., Chromebook incognito mode where `localStorage` is blocked), `src/lib/storage.ts` automatically falls back to an in-memory session map so students never lose progress mid-quiz.
4. **Teacher Capability URLs:** Teacher authorization relies on capability tokens passed in the URL hash (`#<token>`), ensuring links can be bookmarked or shared with co-teachers without complex session handshakes.

---

## 3. The 3 Teacher AI Features in the UI

1. **AI Question & Misconception Generator (`QuizBuilder.tsx`):**  
   Clicking the `AI Generator` button allows teachers to specify a topic and grade level to generate a complete diagnostic question with canonical answers, key concepts, and common student misconceptions.
2. **AI Class-Wide Executive Synthesis & Reteach Plan (`Results.tsx`):**  
   Analyzes all student submissions in the room with one click, outputting the class cognitive health distribution, dominant misconception, and a 10-minute reteach lesson plan.
3. **AI 1-on-1 Pedagogical Desk Intervention Assistant (`ResponseDetail.tsx`):**  
   Generates a turn-by-turn Socratic dialogue script, visual counterexample, and quick check question tailored to that specific student's reasoning, complete with a one-click clipboard copy button.

---

## 4. Local Development & Build Commands

```bash
# Install dependencies
npm install

# Start Vite development server (proxies API requests to http://localhost:8000)
npm run dev

# Run Oxlint linter
npm run lint

# Production build and TypeScript type-check
npm run build
```
