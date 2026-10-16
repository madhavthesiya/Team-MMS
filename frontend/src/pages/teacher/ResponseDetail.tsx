import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTeacherToken } from "../../lib/useTeacherToken";
import { api } from "../../api/client";
import type { Label, OverrideIn, ResponseDetail as ResponseDetailType } from "../../api/types";
import { sourceText, confidenceText } from "../../lib/labels";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/ErrorBox";
import { Banner } from "../../components/Banner";
import { AnimatedBadge } from "../../components/AnimatedBadge";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Brain,
  History,
  Send,
  MessageSquare,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResponseDetail() {
  const { responseId: paramResponseId } = useParams<{ responseId: string }>();
  const { classId, token, error: tokenError } = useTeacherToken();
  const responseId = paramResponseId ? parseInt(paramResponseId, 10) : null;

  const [detail, setDetail] = useState<ResponseDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collapsible trace state
  const [traceOpen, setTraceOpen] = useState(false);

  // Override form state
  const [overrideLabel, setOverrideLabel] = useState<Label>("understood");
  const [overrideMisconceptionId, setOverrideMisconceptionId] = useState<number | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  async function loadDetail() {
    if (!responseId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getResponse(responseId, token);
      setDetail(data);
      setOverrideLabel(data.diagnosis.label);
      setOverrideMisconceptionId(data.diagnosis.misconception_id);
      setOverrideNote(data.diagnosis.note || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load response detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (responseId && token) {
      loadDetail();
    }
  }, [responseId, token]);

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responseId || !token) return;
    setOverriding(true);
    setOverrideError(null);
    setOverrideSuccess(false);

    try {
      const payload: OverrideIn = {
        label: overrideLabel,
        misconception_id: overrideLabel === "misconception" ? overrideMisconceptionId : null,
        note: overrideNote.trim(),
      };
      const updated = await api.overrideResponse(responseId, token, payload);
      setDetail(updated);
      setOverrideSuccess(true);
      setTimeout(() => setOverrideSuccess(false), 3000);
    } catch (err: unknown) {
      setOverrideError(err instanceof Error ? err.message : "Failed to save teacher override.");
    } finally {
      setOverriding(false);
    }
  }

  if (tokenError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={tokenError} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner text="Loading student response and diagnosis…" variant="ai" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={error || "Response not found."} onRetry={loadDetail} />
        </div>
      </div>
    );
  }

  const { question, diagnosis, history, follow_up, trace } = detail;

  return (
    <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-black">
      {/* Studio Header Bar */}
      <div className="shrink-0 border-b border-white/10 bg-zinc-950/90 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/teacher/${classId}/results#${token}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Results</span>
          </Link>
          <span className="text-zinc-700 hidden sm:inline">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded shrink-0">
              Q{question.position}
            </span>
            <h1 className="text-sm font-bold text-white truncate">Student: {detail.nickname}</h1>
            <span className="text-xs text-zinc-500 font-mono hidden md:inline">
              #{detail.response_id}
            </span>
          </div>
        </div>

        {/* Correctness Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {detail.is_correct ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-black border border-white text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-black" /> Correct Answer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-700 text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5 text-zinc-400" /> Incorrect Answer
            </span>
          )}
        </div>
      </div>

      {/* Main Studio Split Layout */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane: Student Evidence, AI Diagnosis & Trace */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Student Reasoning & Explanation Card */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Question Prompt
                </span>
                <h2 className="text-base font-bold text-white font-heading mt-0.5">
                  {question.prompt}
                </h2>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-300 shrink-0">
                Correct: <strong className="text-white">{question.correct_answer}</strong>
              </div>
            </div>

            {/* Answer & Confidence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Student's Answer
                </span>
                <span className="text-xl font-bold font-mono text-white mt-1 block">
                  {detail.answer}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Reported Confidence
                </span>
                <span className="text-sm font-semibold text-zinc-200 capitalize mt-1 block">
                  {confidenceText(detail.self_confidence)}
                </span>
              </div>
            </div>

            {/* Written Explanation */}
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                Student's Written Explanation
              </span>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/15 text-sm text-zinc-100 leading-relaxed font-sans italic">
                "{detail.explanation || <span className="text-zinc-500 not-italic">No explanation provided.</span>}"
              </div>
            </div>

            {question.key_idea && (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 text-xs text-zinc-400">
                <strong className="text-zinc-300 block mb-0.5 font-mono uppercase text-[10px]">
                  Reference Concept (Key Idea):
                </strong>
                {question.key_idea}
              </div>
            )}
          </div>

          {/* AI Diagnosis Verdict Card */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-white" />
                <h3 className="text-base font-bold font-heading text-white">Diagnostic Analysis</h3>
              </div>
              <div className="flex items-center gap-2">
                <AnimatedBadge
                  label={diagnosis.label}
                  misconceptionLabel={diagnosis.misconception_label}
                  certainty={diagnosis.certainty}
                  showCertainty
                  size="md"
                />
              </div>
            </div>

            {/* Hypotheses Breakdown */}
            {diagnosis.hypotheses && diagnosis.hypotheses.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Hypotheses Evaluated by AI Guardrails
                </span>
                <div className="space-y-2">
                  {diagnosis.hypotheses.map((hyp, hIdx) => {
                    const pct = Math.round(hyp.likelihood * 100);
                    return (
                      <div
                        key={hIdx}
                        className="p-3.5 rounded-xl border border-white/10 bg-black/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white capitalize font-mono">
                              {hyp.kind}
                            </span>
                            {hyp.misconception_label && (
                              <span className="text-xs text-zinc-300">
                                — {hyp.misconception_label}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono font-bold text-zinc-200">{pct}%</span>
                        </div>

                        {/* Likelihood progress bar */}
                        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {hyp.evidence_for && (
                          <p className="text-[11px] text-zinc-300">
                            <strong className="text-white font-mono">Evidence For:</strong> "{hyp.evidence_for}"
                          </p>
                        )}
                        {hyp.evidence_against && (
                          <p className="text-[11px] text-zinc-400">
                            <strong className="text-zinc-500 font-mono">Evidence Against:</strong> "{hyp.evidence_against}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Follow-Up Conversation Card (if present) */}
          {follow_up && (
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <MessageSquare className="w-4 h-4 text-white" />
                <h3 className="text-base font-bold font-heading text-white">Targeted Follow-Up Dialogue</h3>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/15 text-xs text-zinc-200">
                  <span className="font-semibold text-white block mb-1">Question asked to student:</span>
                  "{follow_up.question_text}"
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 text-xs">
                  <span className="font-semibold text-zinc-400 block mb-1">Student's reply:</span>
                  {follow_up.student_reply ? (
                    <p className="text-zinc-100 italic">"{follow_up.student_reply}"</p>
                  ) : (
                    <p className="text-zinc-500 italic">Waiting for student's reply…</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expandable Trace Card */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10">
            <button
              type="button"
              onClick={() => setTraceOpen(!traceOpen)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                <span className="text-sm font-bold font-heading text-white">
                  Execution Trace (LLM Latency & Logs)
                </span>
                <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-zinc-300 border border-white/15">
                  {trace.length} step{trace.length === 1 ? "" : "s"}
                </span>
              </div>
              {traceOpen ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            <AnimatePresence>
              {traceOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-white/10 overflow-x-auto"
                >
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400">
                        <th className="pb-2">Step</th>
                        <th className="pb-2">Source</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Latency</th>
                        <th className="pb-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trace.map((step, sIdx) => (
                        <tr key={sIdx} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 font-semibold text-white">{step.step}</td>
                          <td className="py-2.5 text-zinc-400">{step.source}</td>
                          <td className="py-2.5">
                            {step.ok ? (
                              <span className="text-white font-semibold">✓ OK</span>
                            ) : (
                              <span className="text-zinc-500">✗ Failed</span>
                            )}
                          </td>
                          <td className="py-2.5 text-zinc-400">{step.latency_ms} ms</td>
                          <td className="py-2.5 text-zinc-300 max-w-xs truncate">
                            {step.detail || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Pane: Teacher Override Cockpit & History */}
        <div className="w-full lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-zinc-950/70 p-4 sm:p-6 flex flex-col min-h-0 overflow-y-auto space-y-6">
          {/* Teacher Intervention Header */}
          <div className="space-y-1 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wider">
                Teacher Verification Cockpit
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Teacher readings supersede AI guardrails and are permanently appended to the diagnosis audit trail.
            </p>
          </div>

          {overrideError && <ErrorBox message={overrideError} />}
          {overrideSuccess && (
            <Banner tone="success">Teacher override saved. New diagnosis version generated.</Banner>
          )}

          {/* Override Form */}
          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-1.5">
                Target Cognitive Label
              </label>
              <select
                value={overrideLabel}
                onChange={(e) => setOverrideLabel(e.target.value as Label)}
                className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white/20"
              >
                <option value="understood">Understood</option>
                <option value="misread">Misread the question</option>
                <option value="misconception">Misconception</option>
                <option value="guessed">Likely guessed</option>
                <option value="slip">Careless slip</option>
                <option value="not_sure">Not sure yet</option>
              </select>
            </div>

            {overrideLabel === "misconception" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-1.5">
                  Associated Misconception
                </label>
                <select
                  value={overrideMisconceptionId || ""}
                  onChange={(e) =>
                    setOverrideMisconceptionId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white/20"
                >
                  <option value="">Select misconception…</option>
                  {question.misconceptions.map((m) => (
                    <option key={m.misconception_id} value={m.misconception_id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Textarea
                label="Teacher Rationale / Pedagogical Note"
                rows={3}
                maxLength={500}
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="e.g. Discussed 1-on-1 with student — confirmed they understand common denominators."
                hint="Documented reasoning for other educators or future reference."
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={overriding}
              loadingText="Applying Override…"
              icon={<Send className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Apply Teacher Override
            </Button>
          </form>

          {/* Audit History Log */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Revision History ({history.length})</span>
              </div>

              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.version}
                    className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-white">v{h.version}</span>
                        <AnimatedBadge label={h.label} size="sm" />
                      </div>
                      <span className="font-mono text-zinc-500 text-[10px]">
                        {new Date(h.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Determined via <span className="text-zinc-200">{sourceText(h.source)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
