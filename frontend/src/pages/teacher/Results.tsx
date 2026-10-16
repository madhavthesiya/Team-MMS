import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTeacherToken } from "../../lib/useTeacherToken";
import { api } from "../../api/client";
import type { Results as ResultsType, AISummaryOut } from "../../api/types";
import { labelText } from "../../lib/labels";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/ErrorBox";
import { Banner } from "../../components/Banner";
import { EmptyState } from "../../components/EmptyState";
import { AnimatedBadge } from "../../components/AnimatedBadge";
import { Button } from "../../components/ui/Button";
import { ClassNav } from "../../components/ClassNav";
import {
  RefreshCw,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  X,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Results() {
  const { classId, token, error: tokenError } = useTeacherToken();
  const [results, setResults] = useState<ResultsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<"questions" | "detail">("detail");

  // AI Class Executive Synthesis State
  const [aiSummary, setAiSummary] = useState<AISummaryOut | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  async function handleGenerateSummary() {
    if (!classId || !token) return;
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const summary = await api.aiClassSummary(classId, token);
      setAiSummary(summary);
      setShowSummaryModal(true);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate class AI summary.");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadResults(isRefresh = false) {
    if (!classId || !token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.getResults(classId, token);
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load results.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (classId && token) {
      loadResults();
    }
  }, [classId, token]);

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
        <Spinner text="Aggregating classroom diagnoses…" variant="ai" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={error || "No results available."} onRetry={() => loadResults(false)} />
        </div>
      </div>
    );
  }

  const allEmpty = results.questions.every((q) => q.total_responses === 0);
  const activeQ = results.questions[activeQuestionIndex] || results.questions[0];

  return (
    <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-black">
      {/* Google Classroom-Inspired Class Sub-Navigation Bar */}
      <ClassNav
        classId={classId!}
        className={`Class #${classId} Diagnostic Results`}
        token={token || undefined}
        activeTab="results"
      />

      {/* Action Strip */}
      <div className="shrink-0 border-b border-white/10 bg-zinc-950/60 px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Cognitive Diagnostics
          </span>
          <span className="text-zinc-700">•</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
            {results.total_students} student{results.total_students === 1 ? "" : "s"} submitted
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateSummary}
            loading={loadingSummary}
            loadingText="Synthesizing Class…"
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            className="border border-violet-500/30 bg-violet-950/20 hover:bg-violet-900/30 text-violet-200"
          >
            AI Executive Synthesis
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadResults(true)}
            loading={refreshing}
            loadingText="Refreshing…"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* AI rule-only warning if any */}
      {results.rule_only_count > 0 && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
          <Banner tone="warn">
            Some answers were evaluated by rules only ({results.rule_only_count}) because AI analysis
            was temporarily busy or budget-capped.
          </Banner>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden shrink-0 border-b border-white/10 bg-zinc-950 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setMobileTab("questions")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === "questions" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
          }`}
        >
          Questions ({results.questions.length})
        </button>
        <button
          onClick={() => setMobileTab("detail")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === "detail" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
          }`}
        >
          Q{activeQ?.position || 1} Diagnoses
        </button>
      </div>

      {allEmpty ? (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <EmptyState
            title="No responses submitted yet"
            icon={<Users className="w-8 h-8 text-white" />}
          >
            <p>
              Share your student join link or code with your class. Once students submit explanations,
              their diagnostic breakdown will appear here.
            </p>
            <Link to={`/teacher/${classId}#${token}`} className="mt-4 inline-block">
              <Button variant="primary" size="sm">
                View Class Join Code
              </Button>
            </Link>
          </EmptyState>
        </div>
      ) : (
        /* Main Studio Split Layout */
        <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
          {/* Left Pane: Question Selector & Summary */}
          <div
            className={`w-full md:w-80 shrink-0 border-r border-white/10 bg-zinc-950/60 flex flex-col min-h-0 ${
              mobileTab === "detail" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Summary Metrics */}
            <div className="p-3.5 border-b border-white/10 bg-black/40 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Classroom Participants</span>
                <span className="font-mono font-bold text-white">{results.total_students}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Questions Evaluated</span>
                <span className="font-mono font-bold text-white">{results.questions.length}</span>
              </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
              {results.questions.map((q, idx) => {
                const isActive = idx === activeQuestionIndex;
                const correctCount =
                  q.groups.find((g) => g.is_correct)?.count || 0;
                const pct =
                  q.total_responses > 0
                    ? Math.round((correctCount / q.total_responses) * 100)
                    : 0;

                return (
                  <div
                    key={q.question_id}
                    onClick={() => {
                      setActiveQuestionIndex(idx);
                      setMobileTab("detail");
                    }}
                    className={`rounded-xl p-3 border transition-all cursor-pointer select-none ${
                      isActive
                        ? "bg-white/10 border-white text-white shadow-sm"
                        : "bg-zinc-950/70 border-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            isActive
                              ? "bg-white text-black"
                              : "bg-white/10 text-white border border-white/10"
                          }`}
                        >
                          Q{q.position}
                        </span>
                        <p className="text-xs font-medium truncate">{q.prompt}</p>
                      </div>

                      {q.same_score_different_reasons && (
                        <span
                          className="shrink-0 p-1 text-white bg-white/10 rounded-full"
                          title="Same score, different reasoning models"
                        >
                          <Sparkles className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5 text-[11px] text-zinc-400">
                      <span>{q.total_responses} responses</span>
                      <span className="font-mono text-zinc-300">{pct}% correct</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Active Question Diagnoses */}
          <div
            className={`flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 ${
              mobileTab === "questions" ? "hidden md:block" : "block"
            }`}
          >
            {activeQ && (
              <motion.div
                key={activeQ.question_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Question Info Card */}
                <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                          Q{activeQ.position}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {activeQ.total_responses} response{activeQ.total_responses === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                        {activeQ.prompt}
                      </h2>
                    </div>

                    <div className="shrink-0 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200">
                      Correct: <strong className="text-white">{activeQ.correct_answer}</strong>
                    </div>
                  </div>

                  {activeQ.same_score_different_reasons && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/20 flex items-center gap-2.5 text-xs text-white">
                      <Sparkles className="w-4 h-4 text-white shrink-0" />
                      <span>
                        <strong>Divergence Detected:</strong> Multiple students reached the same answer or score,
                        but their underlying explanations reveal completely different cognitive patterns (e.g. true understanding vs. pattern-matching vs. slips).
                      </span>
                    </div>
                  )}
                </div>

                {/* Riddle 2: Same Wrong Answer, Several Stories */}
                {activeQ.wrong_answers && activeQ.wrong_answers.length > 0 && (
                  <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-white/10 text-white">
                          <Sparkles className="w-4 h-4 text-white" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold font-heading text-white">
                            Same Wrong Answer — Several Stories (Riddle 2)
                          </h3>
                          <p className="text-xs text-zinc-400">
                            Students submitted the identical error, but their diagnostic stories diverged.
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
                        {activeQ.wrong_answers.length} wrong answer cluster{activeQ.wrong_answers.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {activeQ.wrong_answers.map((wa, waIdx) => (
                        <div
                          key={waIdx}
                          className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3.5"
                        >
                          {/* Headline: N students answered "..." — for M different stories */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white font-mono bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-700">
                                Answer: "{wa.answer}"
                              </span>
                              <span className="text-xs text-zinc-300 font-medium">
                                <strong className="text-white">{wa.count}</strong> student{wa.count === 1 ? "" : "s"} answered this
                                {wa.stories.length > 1 && (
                                  <> — for <strong className="text-white">{wa.stories.length}</strong> different stories</>
                                )}
                              </span>
                            </div>

                            {wa.several_stories && (
                              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300">
                                Divergent Stories
                              </span>
                            )}
                          </div>

                          {/* Story Breakdown Pills */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {wa.stories.map((story, sIdx) => (
                              <div
                                key={sIdx}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/90 border border-zinc-700 text-xs"
                              >
                                <span className="font-mono font-bold text-white">{story.count}×</span>
                                <span className="text-zinc-300">
                                  {labelText(story.label, story.misconception_label)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Student links */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                            <span className="text-[11px] font-mono uppercase text-zinc-500">Students:</span>
                            {wa.students.map((st) => (
                              <Link
                                key={st.response_id}
                                to={`/teacher/${classId}/responses/${st.response_id}#${token}`}
                                className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300 hover:text-white transition-all font-mono"
                              >
                                <span>{st.nickname}</span>
                                <ChevronRight className="w-3 h-3 text-zinc-500 group-hover:text-white transition-transform" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Correct vs Incorrect Split Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {activeQ.groups.map((group, gIndex) => (
                    <div
                      key={gIndex}
                      className={`rounded-2xl p-5 border flex flex-col space-y-4 ${
                        group.is_correct
                          ? "border-white/20 bg-zinc-950/90"
                          : "border-zinc-800 bg-zinc-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          {group.is_correct ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                            <XCircle className="w-4 h-4 text-zinc-400" />
                          )}
                          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                            {group.is_correct ? "Correct Answers" : "Incorrect Answers"} ({group.count})
                          </h3>
                        </div>
                      </div>

                      {group.labels.length === 0 ? (
                        <p className="text-xs text-zinc-500 py-4 text-center">No students in this group.</p>
                      ) : (
                        <div className="space-y-3">
                          {group.labels.map((lg, lIndex) => (
                            <div
                              key={lIndex}
                              className="rounded-xl p-3.5 bg-black/60 border border-white/5 space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <AnimatedBadge label={lg.label} size="sm" />
                                <span className="text-xs font-mono text-zinc-400 font-semibold">
                                  {lg.count} student{lg.count === 1 ? "" : "s"}
                                </span>
                              </div>

                              {/* Student Nickname Chips */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {lg.students.map((st) => (
                                  <Link
                                    key={st.response_id}
                                    to={`/teacher/${classId}/responses/${st.response_id}#${token}`}
                                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-400 text-xs text-zinc-200 hover:text-white transition-all shadow-sm"
                                  >
                                    <span className="font-medium">{st.nickname}</span>
                                    {st.status === "open" && (
                                      <span className="text-[10px] text-zinc-400 font-mono">
                                        (pending reply)
                                      </span>
                                    )}
                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* AI Executive Synthesis Modal */}
      {showSummaryModal && aiSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950 border border-violet-500/30 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Class Cognitive Executive Synthesis
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {aiSummary.generated_by_model}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Topic: {aiSummary.quiz_topic} • Accuracy: {aiSummary.accuracy_percentage}% ({aiSummary.correct_count}/{aiSummary.total_students})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {summaryError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                  {summaryError}
                </div>
              )}

              {/* Executive Assessment */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-bold block flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Pedagogical Executive Assessment
                </span>
                <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line">
                  {aiSummary.executive_summary}
                </p>
              </div>

              {/* Dominant Misconception Roadblock */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Dominant Cognitive Roadblock in Classroom
                </span>
                <p className="text-xs text-red-100/90 leading-relaxed font-medium">
                  {aiSummary.dominant_misconception}
                </p>
              </div>

              {/* Undercover Guessers Warning (Riddle 1) */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Riddle 1 Alert • Undercover Guessers (Right Answer, Wrong Reason)
                </span>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  {aiSummary.undercover_guessers_warning}
                </p>
              </div>

              {/* 10-Minute Next-Lesson Reteach Strategy */}
              <div className="space-y-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                  10-Minute Next-Lesson Warm-Up Reteach Plan
                </span>

                <div className="space-y-2">
                  {aiSummary.ten_minute_reteach_plan.map((step, sIdx) => (
                    <div key={sIdx} className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 flex items-start gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-violet-600 text-white shrink-0 mt-0.5">
                        Step {sIdx + 1}
                      </span>
                      <p className="text-xs text-white leading-relaxed">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Differentiated Student Action Groups */}
              {aiSummary.differentiated_groups && aiSummary.differentiated_groups.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-violet-400" />
                    Differentiated Small-Group Directives
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiSummary.differentiated_groups.map((grp, gIdx) => (
                      <div key={gIdx} className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white text-xs">{grp.group_name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                            {grp.student_count} student{grp.student_count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Focus Story: <span className="text-zinc-200 capitalize font-mono">{grp.focus_story}</span>
                        </p>
                        {grp.student_nicknames && grp.student_nicknames.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {grp.student_nicknames.map((nick, nIdx) => (
                              <span key={nIdx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300">
                                {nick}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-indigo-300 bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/20">
                          🎯 {grp.suggested_action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 flex justify-end bg-zinc-900/50">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSummaryModal(false)}
              >
                Close Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
