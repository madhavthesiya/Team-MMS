export type AnswerType = "number" | "text" | "choice";
export type Confidence = "sure" | "unsure" | "guessed";
export type Label = "understood" | "misread" | "misconception" | "guessed" | "slip" | "not_sure";
export type HypothesisKind = Exclude<Label, "not_sure">;
export type Source = "rule" | "ai" | "both" | "teacher";
export type Status = "open" | "settled" | "not_sure";
export type HypStatus = "open" | "supported" | "ruled_out";

export interface ClassCreated {
  class_id: number;
  name: string;
  join_code: string;
  teacher_token: string;
}

export interface MisconceptionIn {
  label: string;
  trigger_answers: string[];
  signal_text: string;
  remedy_hint: string;
}

export interface QuestionIn {
  prompt: string;
  correct_answer: string;
  answer_type: AnswerType;
  key_idea: string;
  choices: string[];
  misconceptions: MisconceptionIn[];
}

export interface QuizIn {
  topic: string;
  title: string;
  questions: QuestionIn[];
}

export interface Misconception extends MisconceptionIn {
  misconception_id: number;
}

export interface Question extends Omit<QuestionIn, "misconceptions"> {
  question_id: number;
  position: number;
  misconceptions: Misconception[];
}

export interface Quiz {
  quiz_id: number;
  topic: string;
  title: string;
  questions: Question[];
}

export interface ClassInfo {
  class_id: number;
  name: string;
  join_code: string;
  is_sample: boolean;
  created_at: string;
  quiz: Quiz | null;
}

export interface StudentQuestion {
  question_id: number;
  position: number;
  prompt: string;
  answer_type: AnswerType;
  choices: string[];
}

export interface StudentQuiz {
  topic: string;
  title: string;
  questions: StudentQuestion[];
}

export interface PendingFollowUp {
  follow_up_id: number;
  question_id: number;
  question_text: string;
}

export interface StudentInfo {
  student_id: number;
  nickname: string;
  class_name: string;
  quiz: StudentQuiz | null;
  answered_question_ids: number[];
  pending_follow_ups: PendingFollowUp[];
}

export interface JoinResult extends StudentInfo {
  student_token: string;
}

export interface ResponseIn {
  question_id: number;
  answer: string;
  explanation: string;
  self_confidence: Confidence;
}

export interface FollowUp {
  follow_up_id: number;
  question_text: string;
}

export interface SubmitResult {
  response_id: number;
  follow_up: FollowUp | null;
}

export interface StudentEntry {
  student_id: number;
  nickname: string;
  response_id: number;
  label: Label;
  misconception_label: string | null;
  certainty: number;
  status: Status;
  source: Source;
}

export interface LabelGroup {
  label: Label;
  count: number;
  students: StudentEntry[];
}

export interface CorrectnessGroup {
  is_correct: boolean;
  count: number;
  labels: LabelGroup[];
}

export interface QuestionResults {
  question_id: number;
  position: number;
  prompt: string;
  correct_answer: string;
  total_responses: number;
  same_score_different_reasons: boolean;
  groups: CorrectnessGroup[];
}

export interface Results {
  class_id: number;
  total_students: number;
  rule_only_count: number;
  questions: QuestionResults[];
}

export interface Hypothesis {
  kind: HypothesisKind;
  misconception_id: number | null;
  misconception_label: string | null;
  evidence_for: string;
  evidence_against: string;
  likelihood: number;
  status: HypStatus;
}

export interface DiagnosisView {
  diagnosis_id: number;
  version: number;
  label: Label;
  misconception_id: number | null;
  misconception_label: string | null;
  certainty: number;
  source: Source;
  status: Status;
  note: string;
  created_at: string;
  hypotheses: Hypothesis[];
}

export interface HistoryEntry {
  version: number;
  label: Label;
  source: Source;
  certainty: number;
  status: Status;
  created_at: string;
}

export interface FollowUpView {
  question_text: string;
  student_reply: string | null;
  answered_at: string | null;
}

export interface TraceStep {
  step: string;
  source: string;
  model: string | null;
  prompt_version: string | null;
  latency_ms: number;
  ok: boolean;
  detail: string | null;
}

export interface ResponseDetail {
  response_id: number;
  student_id: number;
  nickname: string;
  question: Question;
  answer: string;
  explanation: string;
  self_confidence: Confidence;
  is_correct: boolean;
  created_at: string;
  diagnosis: DiagnosisView;
  history: HistoryEntry[];
  follow_up: FollowUpView | null;
  trace: TraceStep[];
}

export interface OverrideIn {
  label: Label;
  misconception_id: number | null;
  note: string;
}
