export type AnswerType = "number" | "text" | "choice";
export type Confidence = "sure" | "unsure" | "guessed";
export type Label = "understood" | "misread" | "misconception" | "guessed" | "slip" | "out_of_time" | "not_sure";
export type HypothesisKind = Exclude<Label, "not_sure">;
export type Source = "rule" | "ai" | "both" | "teacher";
export type Status = "open" | "settled" | "not_sure";
export type HypStatus = "open" | "supported" | "ruled_out";
export type DeclineReason = "skip" | "not_sure" | "teacher";

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
  time_limit_seconds?: number | null;
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
  time_limit_seconds?: number | null;
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
  time_limit_seconds?: number | null;
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
  reply_saved?: boolean;
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
  explanation?: string;
  self_confidence: Confidence;
  time_spent_seconds?: number | null;
  timed_out?: boolean;
  ran_out_of_time?: boolean;
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

export interface StoryCount {
  label: Label;
  misconception_label: string | null;
  count: number;
}

export interface WrongAnswerGroup {
  answer: string;
  count: number;
  several_stories: boolean;
  stories: StoryCount[];
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
  same_wrong_answer_different_stories: boolean;
  groups: CorrectnessGroup[];
  wrong_answers: WrongAnswerGroup[];
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
  would_confirm: string;
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
  rationale: string;
  expected_evidence: {
    kind: HypothesisKind;
    misconception_id: number | null;
    observation: string;
  }[];
  declined_reason: DeclineReason | "";
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
  time_spent_seconds: number | null;
  timed_out: boolean;
  ran_out_of_time: boolean;
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

export interface ScriptTurn {
  teacher_prompt: string;
  anticipated_student_thinking: string;
}

export interface AIInterventionOut {
  student_nickname: string;
  diagnosed_label: string;
  misconception_name: string | null;
  misconception_breakdown: string;
  one_on_one_script: ScriptTurn[];
  concrete_counterexample: string;
  check_for_understanding_question: string;
  generated_by_model: string;
}

export interface AIGenerateQuestionIn {
  topic: string;
  grade_level?: string;
  misconception_focus?: string;
}

export interface AIMisconceptionDraft {
  label: string;
  trigger_answers: string[];
  signal_text: string;
  remedy_hint: string;
}

export interface AIGenerateQuestionOut {
  prompt: string;
  correct_answer: string;
  answer_type: AnswerType;
  key_idea: string;
  choices: string[];
  misconceptions: AIMisconceptionDraft[];
  time_limit_seconds: number;
}

export interface DifferentiatedGroup {
  group_name: string;
  focus_story: string;
  student_count: number;
  student_nicknames: string[];
  suggested_action: string;
}

export interface AISummaryOut {
  class_name: string;
  quiz_topic: string;
  total_students: number;
  correct_count: number;
  accuracy_percentage: number;
  executive_summary: string;
  dominant_misconception: string;
  undercover_guessers_warning: string;
  ten_minute_reteach_plan: string[];
  differentiated_groups: DifferentiatedGroup[];
  generated_by_model: string;
}

