# Track B — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BehindTheMark React UI — landing, teacher setup/quiz builder/results/response detail, student join/answer/follow-up — against `docs/api-contract.md`.

**Architecture:** Vite + React + TypeScript SPA in `frontend/`. A typed API client (`src/api/`) is the only code that calls `fetch`. Pages under `src/pages/`, shared state components under `src/components/`. In dev, Vite proxies `/api` to the FastAPI backend on `localhost:8000`; in production FastAPI serves `frontend/dist`.

**Tech Stack:** Vite 8, React 19, TypeScript, react-router-dom 7, Tailwind CSS 4 (`@tailwindcss/vite`).

## Global Constraints

- **No fake data in `frontend/`.** The judges scan this folder for hard-coded outputs. Never commit mock responses, fixture JSON or fake results. Until the backend endpoint you need exists, run the backend locally (Track A lands classes/quiz endpoints first, student flow next).
- Talk to the backend **only** through `src/api/client.ts`. Contract: `docs/api-contract.md` (source of truth — if it disagrees with this plan, the contract wins).
- Every screen that loads data has **loading**, **error (with Retry)** and **empty** states.
- Mobile-first: everything usable at 360 px wide; no horizontal scroll.
- Never show raw enum values to users — use `src/lib/labels.ts`.
- Students never see correctness or diagnosis labels.
- `localStorage` access wrapped in try/catch (private windows throw).
- Frontend code quality is not scored; screenshots, usability and phone view are. Spend time on clarity and states, not abstractions.

## File Structure

```
frontend/
  vite.config.ts            dev proxy /api → :8000
  src/main.tsx              router bootstrap
  src/index.css             tailwind import + base styles
  src/App.tsx               routes
  src/api/types.ts          TS types mirroring the contract
  src/api/client.ts         fetch wrapper + one function per endpoint
  src/lib/labels.ts         enum → UI copy
  src/lib/storage.ts        teacher tokens / student session in localStorage
  src/components/Layout.tsx, Spinner.tsx, ErrorBox.tsx, EmptyState.tsx, Banner.tsx, CopyField.tsx
  src/pages/Landing.tsx
  src/pages/teacher/CreateClass.tsx, ClassHome.tsx, QuizBuilder.tsx, Results.tsx, ResponseDetail.tsx
  src/pages/student/Join.tsx, Quiz.tsx
```

---

### Task B1: Scaffold Vite + React + Tailwind + router

**Files:** Create `frontend/` (generated), modify `frontend/vite.config.ts`, `frontend/src/index.css`, `frontend/src/main.tsx`

- [ ] **Step 1: Generate the app** (from repo root)

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Replace `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
});
```

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
@import "tailwindcss";

html, body, #root { min-height: 100%; }
body { @apply bg-slate-50 text-slate-900 antialiased; }
```

- [ ] **Step 4: Replace `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

Delete `src/App.css` and `src/assets/` if unused. Set `<title>BehindTheMark</title>` in `index.html`.

- [ ] **Step 5: Verify** — `npm run build` succeeds (App.tsx comes in B4; temporarily keep the generated one).

- [ ] **Step 6: Commit** — `git add frontend && git commit -m "feat(frontend): scaffold vite react tailwind"`

---

### Task B2: API types, client, labels, storage

**Files:** Create `src/api/types.ts`, `src/api/client.ts`, `src/lib/labels.ts`, `src/lib/storage.ts`

- [ ] **Step 1: `src/api/types.ts`**

```ts
export type AnswerType = "number" | "text" | "choice";
export type Confidence = "sure" | "unsure" | "guessed";
export type Label = "understood" | "misread" | "misconception" | "guessed" | "slip" | "out_of_time" | "not_sure";
export type HypothesisKind = Exclude<Label, "not_sure">;
export type Source = "rule" | "ai" | "both" | "teacher";
export type Status = "open" | "settled" | "not_sure";
export type HypStatus = "open" | "supported" | "ruled_out";

export interface ClassCreated { class_id: number; name: string; join_code: string; teacher_token: string }

export interface MisconceptionIn { label: string; trigger_answers: string[]; signal_text: string; remedy_hint: string }
export interface QuestionIn {
  prompt: string; correct_answer: string; answer_type: AnswerType; key_idea: string;
  choices: string[]; misconceptions: MisconceptionIn[]; time_limit_seconds: number | null;
}
export interface QuizIn { topic: string; title: string; questions: QuestionIn[] }

export interface Misconception extends MisconceptionIn { misconception_id: number }
export interface Question extends Omit<QuestionIn, "misconceptions"> {
  question_id: number; position: number; misconceptions: Misconception[];
}
export interface Quiz { quiz_id: number; topic: string; title: string; questions: Question[] }
export interface ClassInfo {
  class_id: number; name: string; join_code: string; is_sample: boolean; created_at: string; quiz: Quiz | null;
}

export interface StudentQuestion {
  question_id: number; position: number; prompt: string; answer_type: AnswerType; choices: string[];
  time_limit_seconds: number | null;
}
export interface StudentQuiz { topic: string; title: string; questions: StudentQuestion[] }
export interface PendingFollowUp { follow_up_id: number; question_id: number; question_text: string; reply_saved: boolean }
export interface StudentInfo {
  student_id: number; nickname: string; class_name: string; quiz: StudentQuiz | null;
  answered_question_ids: number[]; pending_follow_ups: PendingFollowUp[];
}
export interface JoinResult extends StudentInfo { student_token: string }

export interface ResponseIn {
  question_id: number; answer: string; explanation: string; self_confidence: Confidence;
  time_spent_seconds: number; timed_out: boolean; ran_out_of_time: boolean;
}
export interface FollowUp { follow_up_id: number; question_text: string }
export interface SubmitResult { response_id: number; follow_up: FollowUp | null }

export interface StudentEntry {
  student_id: number; nickname: string; response_id: number; label: Label;
  misconception_label: string | null; certainty: number; status: Status; source: Source;
}
export interface LabelGroup { label: Label; count: number; students: StudentEntry[] }
export interface CorrectnessGroup { is_correct: boolean; count: number; labels: LabelGroup[] }
export interface StoryCount { label: Label; misconception_label: string | null; count: number }
export interface WrongAnswerGroup {
  answer: string; count: number; several_stories: boolean; stories: StoryCount[]; students: StudentEntry[];
}
export interface QuestionResults {
  question_id: number; position: number; prompt: string; correct_answer: string;
  total_responses: number; same_score_different_reasons: boolean; same_wrong_answer_different_stories: boolean;
  groups: CorrectnessGroup[]; wrong_answers: WrongAnswerGroup[];
}
export interface Results { class_id: number; total_students: number; rule_only_count: number; questions: QuestionResults[] }

export interface Hypothesis {
  kind: HypothesisKind; misconception_id: number | null; misconception_label: string | null;
  evidence_for: string; evidence_against: string; likelihood: number; status: HypStatus; would_confirm: string;
}
export interface DiagnosisView {
  diagnosis_id: number; version: number; label: Label; misconception_id: number | null;
  misconception_label: string | null; certainty: number; source: Source; status: Status; note: string;
  created_at: string; hypotheses: Hypothesis[];
}
export interface HistoryEntry { version: number; label: Label; source: Source; certainty: number; status: Status; created_at: string }
export interface FollowUpView { question_text: string; student_reply: string | null; answered_at: string | null }
export interface TraceStep {
  step: string; source: string; model: string | null; prompt_version: string | null;
  latency_ms: number; ok: boolean; detail: string | null;
}
export interface ResponseDetail {
  response_id: number; student_id: number; nickname: string; question: Question;
  answer: string; explanation: string; self_confidence: Confidence; is_correct: boolean; created_at: string;
  time_spent_seconds: number | null; timed_out: boolean; ran_out_of_time: boolean;
  diagnosis: DiagnosisView; history: HistoryEntry[]; follow_up: FollowUpView | null; trace: TraceStep[];
}
export interface OverrideIn { label: Label; misconception_id: number | null; note: string }
```

- [ ] **Step 2: `src/api/client.ts`**

```ts
import type {
  ClassCreated, ClassInfo, JoinResult, OverrideIn, Quiz, QuizIn, ResponseDetail, ResponseIn,
  Results, StudentInfo, SubmitResult,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Auth = { teacher?: string; student?: string };

function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return `Please check your input: ${detail[0].msg}`;
  }
  if (status >= 500) return "The server had a problem. Please try again.";
  return `Request failed (${status}).`;
}

async function request<T>(method: string, path: string, body?: unknown, auth: Auth = {}, timeoutMs = 30000): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.teacher) headers["X-Teacher-Token"] = auth.teacher;
  if (auth.student) headers["X-Student-Token"] = auth.student;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(res.status, data));
  return data as T;
}

export const api = {
  createClass: (name: string) => request<ClassCreated>("POST", "/classes", { name }),
  createSampleClass: () => request<ClassCreated>("POST", "/classes/sample"),
  getClass: (id: number, token: string) => request<ClassInfo>("GET", `/classes/${id}`, undefined, { teacher: token }),
  saveQuiz: (id: number, token: string, quiz: QuizIn) => request<Quiz>("PUT", `/classes/${id}/quiz`, quiz, { teacher: token }),
  deleteClass: (id: number, token: string) => request<void>("DELETE", `/classes/${id}`, undefined, { teacher: token }),
  getResults: (id: number, token: string) => request<Results>("GET", `/classes/${id}/results`, undefined, { teacher: token }),
  getResponse: (rid: number, token: string) => request<ResponseDetail>("GET", `/responses/${rid}`, undefined, { teacher: token }),
  overrideResponse: (rid: number, token: string, body: OverrideIn) =>
    request<ResponseDetail>("POST", `/responses/${rid}/override`, body, { teacher: token }),
  join: (join_code: string, nickname: string) => request<JoinResult>("POST", "/join", { join_code, nickname }),
  me: (token: string) => request<StudentInfo>("GET", "/students/me", undefined, { student: token }),
  submit: (token: string, body: ResponseIn) => request<SubmitResult>("POST", "/responses", body, { student: token }, 45000),
  reply: (token: string, followUpId: number, reply: string) =>
    request<{ status: "done" }>("POST", `/follow-ups/${followUpId}/reply`, { reply }, { student: token }, 45000),
  resume: (token: string, followUpId: number) =>
    request<{ status: "done" }>("POST", `/follow-ups/${followUpId}/resume`, undefined, { student: token }, 45000),
};
```

- [ ] **Step 3: `src/lib/labels.ts`**

```ts
import type { Label, Source } from "../api/types";

export function labelText(label: Label, misconceptionLabel?: string | null): string {
  switch (label) {
    case "understood": return "Understood";
    case "misread": return "Missed a condition in the question";
    case "misconception": return misconceptionLabel ? `Mistaken rule: ${misconceptionLabel}` : "Mistaken rule";
    case "guessed": return "Likely guessed";
    case "slip": return "Careless slip";
    case "out_of_time": return "Ran out of time";
    case "not_sure": return "Several stories — not chosen yet";
  }
}

export const labelColor: Record<Label, string> = {
  understood: "bg-emerald-100 text-emerald-800",
  misread: "bg-sky-100 text-sky-800",
  misconception: "bg-amber-100 text-amber-900",
  guessed: "bg-violet-100 text-violet-800",
  slip: "bg-slate-200 text-slate-800",
  out_of_time: "bg-orange-100 text-orange-900",
  not_sure: "bg-rose-100 text-rose-800",
};

export function sourceText(source: Source): string {
  return { rule: "Rules only", ai: "AI", both: "Rules + AI agree", teacher: "Teacher" }[source];
}
```

- [ ] **Step 4: `src/lib/storage.ts`**

```ts
// localStorage can throw (private windows, blocked site data). Keep an in-memory copy so the
// current tab stays signed in even when nothing can be persisted.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch { /* fall through to memory */ }
  return memory.get(key) ?? null;
}
function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* memory copy still works for this tab */ }
}

export const storage = {
  teacherToken: (classId: number) => read(`btm.teacher.${classId}`),
  setTeacherToken: (classId: number, token: string) => write(`btm.teacher.${classId}`, token),
  studentToken: () => read("btm.student"),
  setStudentToken: (token: string | null) => write("btm.student", token),
};
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit` passes.
- [ ] **Step 6: Commit** — `git commit -am "feat(frontend): typed api client, labels, storage"` (add new files first).

---

### Task B3: Shared state components

**Files:** Create `src/components/Layout.tsx`, `Spinner.tsx`, `ErrorBox.tsx`, `EmptyState.tsx`, `Banner.tsx`, `CopyField.tsx`

- [ ] **Step 1: Write the components**

```tsx
// Layout.tsx
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">BehindTheMark</Link>
        <span className="text-xs text-slate-500">Same score. Different story.</span>
      </header>
      <main className="flex-1 pb-12">{children}</main>
    </div>
  );
}
```

```tsx
// Spinner.tsx
export function Spinner({ text = "Loading…" }: { text?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      {text}
    </div>
  );
}
```

```tsx
// ErrorBox.tsx
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="my-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white">
          Try again
        </button>
      )}
    </div>
  );
}
```

```tsx
// EmptyState.tsx
import type { ReactNode } from "react";
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="my-6 rounded-lg border border-dashed border-slate-300 p-6 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}
```

```tsx
// Banner.tsx
export function Banner({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900";
  return <div className={`my-3 rounded-lg border p-3 text-sm ${cls}`}>{children}</div>;
}
```

```tsx
// CopyField.tsx
import { useState } from "react";
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  }
  return (
    <div className="my-2">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <div className="mt-1 flex gap-2">
        <input readOnly value={value} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm" />
        <button onClick={copy} className="rounded-md bg-slate-800 px-3 text-sm text-white">{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit`. **Commit** `feat(frontend): shared state components`.

---

### Task B4: Routes

**Files:** Replace `src/App.tsx`

- [ ] **Step 1:**

```tsx
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import CreateClass from "./pages/teacher/CreateClass";
import ClassHome from "./pages/teacher/ClassHome";
import QuizBuilder from "./pages/teacher/QuizBuilder";
import Results from "./pages/teacher/Results";
import ResponseDetail from "./pages/teacher/ResponseDetail";
import Join from "./pages/student/Join";
import StudentQuiz from "./pages/student/Quiz";
import { EmptyState } from "./components/EmptyState";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/teacher/new" element={<CreateClass />} />
        <Route path="/teacher/:classId" element={<ClassHome />} />
        <Route path="/teacher/:classId/quiz" element={<QuizBuilder />} />
        <Route path="/teacher/:classId/results" element={<Results />} />
        <Route path="/teacher/:classId/responses/:responseId" element={<ResponseDetail />} />
        <Route path="/join" element={<Join />} />
        <Route path="/student" element={<StudentQuiz />} />
        <Route path="*" element={<EmptyState title="Page not found">Go back to the home page.</EmptyState>} />
      </Routes>
    </Layout>
  );
}
```

- [ ] **Step 2:** Create each page file exporting a default component that renders its heading, so the build passes; fill them in B5–B9. Commit `feat(frontend): routes`.

**Teacher token rule (used by every teacher page):** read `classId` from the URL; token = `location.hash.slice(1)` if present (then `storage.setTeacherToken(classId, token)` and keep the hash), else `storage.teacherToken(classId)`. No token → ErrorBox "Open this class with your teacher link." Put this in a small hook `src/lib/useTeacherToken.ts`.

---

### Task B5: Landing

**Files:** `src/pages/Landing.tsx`

Content and behaviour:
- Headline "Same score. Different story." and one paragraph: two students both get 7/10 — one understood and slipped, one guessed. BehindTheMark asks students to explain, checks their reasoning, and shows the teacher why — so each gets the right next step.
- Three buttons: **Create a class** → `/teacher/new`; **Join as a student** → `/join`; **Try the sample class** → calls `api.createSampleClass()`, stores token, navigates to `/teacher/{id}#{token}`. Show Spinner text "Setting up the sample class…" while waiting; ErrorBox with retry on failure.
- "How to try it in 1 minute" guide (3 steps): 1) Try the sample class. 2) Open the join link on your phone (or a private window) and answer a question with an explanation. 3) Come back to the teacher view and open Results.

Accept: works at 360 px; buttons are full width on mobile. Commit `feat(frontend): landing`.

### Task B6: Teacher — create class and class home

**Files:** `CreateClass.tsx`, `ClassHome.tsx`, `src/lib/useTeacherToken.ts`

- **CreateClass:** one input "Class name" (1–80 chars, required), submit → `api.createClass` → store token → navigate `/teacher/{id}#{token}`. Show inline validation and ErrorBox on API error.
- **ClassHome:** loads `api.getClass`. Shows: class name (+ "Sample" badge if `is_sample`), **CopyField "Student join code"**, **CopyField "Student join link"** = `${origin}/join?code=${join_code}`, **CopyField "Your teacher link — save it, it's the only way back"** = `${origin}/teacher/${id}#${token}`. Buttons: **Edit quiz** (→ `/quiz`), **View results** (→ `/results`), **Delete class** (confirm dialog → `api.deleteClass` → navigate `/`).
- Empty state when `quiz === null`: "No questions yet. Add a quiz so students can start." with button to builder.
- If quiz exists: list question prompts (position + prompt) with count of misconceptions each.

Accept: loading/error/empty all reachable; 403 shows "This teacher link doesn't match the class." Commit `feat(frontend): teacher class home`.

### Task B7: Teacher — quiz builder

**Files:** `QuizBuilder.tsx`

- Loads class; if quiz exists, pre-fill the form from it (strip ids).
- Fields: topic, title; list of questions (add / remove / move up). Per question: prompt (textarea), answer type (select number/text/choice), optional time limit in seconds (empty = no timer; 10–3600), correct answer, key idea (textarea, helper text "What would a student who really understands say?"), choices (only when type = choice; add/remove; correct answer picked from choices via radio), misconceptions list (add/remove) with label, trigger answers (comma-separated input → array, trimmed, empty removed), signal text, remedy hint.
- Client-side checks mirror the contract limits (required fields, ≤20 questions, ≤6 misconceptions, choice needs ≥2 choices). Server 422 → show the message from ApiError at the top; 409 → "Students have already answered — this quiz is locked."
- Save → `api.saveQuiz` → navigate back to class home.
- Helper copy at top: "Misconceptions are optional. Add the wrong answers you expect and what they usually mean — the system checks every explanation either way."

Accept: can create a 3-question quiz on a phone without horizontal scroll. Commit `feat(frontend): quiz builder`.

### Task B8: Student — join, answer, follow-up

**Files:** `student/Join.tsx`, `student/Quiz.tsx`

- **Join:** code input (pre-filled from `?code=`; uppercase), nickname input (1–30, helper "Use a nickname — not your full name"). Submit → `api.join` → `storage.setStudentToken(token)` → `/student`. 404 → "No class with that code."
- **Quiz:** load `api.me(token)` (no token → redirect `/join`). `quiz === null` → EmptyState "Your teacher hasn't added questions yet." Show first question not in `answered_question_ids`; progress "Question 3 of 10".
  - Consent notice above the first question (once): "Your explanation is checked by an AI to help your teacher understand your thinking. Don't include personal details."
  - Inputs: answer (number/text → text input; choice → radio buttons), explanation textarea ("How did you get this? Explain in your own words."), confidence segmented control (Sure / Not sure / I guessed → `sure|unsure|guessed`), and a tick box "I ran out of time" (`ran_out_of_time`). Submit disabled until answer + confidence set.
  - Timing (Riddle 2): start a clock when the question appears; send `time_spent_seconds` (whole seconds) on submit. If the question has `time_limit_seconds`, show a visible countdown; at zero, auto-submit whatever is typed with `timed_out: true` (blank answer → send "-" to meet the 1-char minimum; confidence defaults to `unsure`). Never auto-submit on questions without a timer.
  - Submit → Spinner "Reading your reasoning…" (can take up to 10 s) → if `follow_up` → show it as "One quick question" with a reply textarea → `api.reply` → next question; else next question.
  - Riddle 3 / API v1.4: the check is optional and untimed. Offer “I’m not sure”, “Skip this check”, “Discuss with my teacher” via `declineFollowUp`; then recover `me`. Do not interpret a decline as guessing. See [the Riddle 3 delta](2026-10-17-riddle-3.md).
  - **Pending follow-ups first:** on load, if `pending_follow_ups` is non-empty, handle the first one before any new question. `reply_saved: false` → show it ("One quick question about Q{n}") with a reply box. `reply_saved: true` → show "Finishing up…" and call `api.resume`, then re-fetch `me`. A refresh mid-follow-up must land back on it.
  - 409 on submit or a network error/timeout after submitting → re-fetch `api.me` and continue from its state (it may now have a pending follow-up). Network error before the request reached the server → ErrorBox with retry keeping the typed text.
  - Submit/reply can take up to ~30 s server-side; client timeout is 45 s.
  - Done screen: "All done — thanks, {nickname}! Your teacher will use your explanations to plan what's next." No scores, no labels.

Accept: whole flow works on a phone. Commit `feat(frontend): student flow`.

### Task B9: Teacher — results and response detail

**Files:** `teacher/Results.tsx`, `teacher/ResponseDetail.tsx`

- **Results:** load `api.getResults`; Refresh button. If `rule_only_count > 0` → Banner warn "Some answers were checked by rules only — the AI was unavailable." Empty when every question has `total_responses === 0`: "No responses yet — share code {join_code}".
  - Per question card: "Q{position}. {prompt}", correct answer, "{total} responses". If `same_score_different_reasons` → highlight chip "Same score, different reasons". If `same_wrong_answer_different_stories` → chip "Same mistake, different stories".
  - **Same wrong answer section (Riddle 2):** for each `wrong_answers` group: "{count} students answered **{answer}**", then one pill per story with its count (e.g. "Mistaken rule: bigger denominator ×1 · Missed a condition ×1 · Ran out of time ×1"), then nicknames linking to response detail. Put this section above the right/wrong breakdown when `several_stories` is true.
  - Inside: two sections "Got it right ({count})" and "Got it wrong ({count})"; within each, one row per label group: label pill (`labelText`, `labelColor`) + count + nicknames as links to `/teacher/{id}/responses/{response_id}`. Status `open` shows "(waiting for follow-up)".
- **ResponseDetail:** load `api.getResponse`.
  - Evidence block (unchanged student work): question prompt, correct answer, student answer (✓/✗), explanation (quoted), confidence.
  - Current reading: label pill, certainty as %, source (`sourceText`), status; note if teacher override.
  - "Stories considered" list (Riddle 2: a mistake is a clue, not a verdict) — show every hypothesis, grouped: **Chosen** (`supported`), **Still possible** (`open`), **Ruled out** (`ruled_out`). Each shows: story label, likelihood %, evidence (blockquote), evidence against (for ruled-out stories this is the reason), and "What would confirm it: {would_confirm}" when present.
  - Timing line in the evidence block: "Answered in {time_spent_seconds} s", plus "Timer ran out" / "Said they ran out of time" badges when set.
  - Follow-up block if present: question + reply (or "Waiting for the student's reply").
  - Riddle 3: show teacher-only rationale, predicted observations (clearly labelled as predictions, never evidence), and the actual reply or decline choice. Teacher override remains authoritative.
  - "Why this label?" collapsible: trace table (step, source, ok ✓/✗, latency ms, detail).
  - History list (older versions).
  - Override form: label select (all six), misconception select when label = misconception (options from `question.misconceptions`), note textarea → `api.overrideResponse` → re-render with returned detail.

Accept: results readable on a phone (cards stack). Commit `feat(frontend): results and response detail`.

### Task B10: Polish pass + Frontend Pack screenshots

- [ ] Check every page at 360 px and desktop; fix overflow.
- [ ] Force each state once and capture with Track C for the Frontend Pack (8–12 real screenshots): landing, quiz builder, student question, "Reading your reasoning…" loading, follow-up, results with "Same score, different reasons", response detail with hypotheses + trace, an error state (stop backend → ErrorBox), an empty state (new class, no quiz), phone view of student flow.
- [ ] `npm run build` clean. Commit `chore(frontend): polish`.
