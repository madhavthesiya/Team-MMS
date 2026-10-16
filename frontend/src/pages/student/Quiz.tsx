import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { storage } from "../../lib/storage";
import type { Confidence, DeclineReason, StudentInfo, StudentQuestion } from "../../api/types";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/ErrorBox";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Input } from "../../components/ui/Input";
import {
  Send,
  CheckCircle2,
  MessageSquare,
  Brain,
  Shield,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

export default function StudentQuiz() {
  const navigate = useNavigate();
  const token = storage.studentToken();

  const [info, setInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form input state
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [confidence, setConfidence] = useState<Confidence | "">("");

  // Timing & Riddle 2 state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [ranOutOfTime, setRanOutOfTime] = useState(false);

  // Submitting response
  const [submitting, setSubmitting] = useState(false);

  // Follow-up state
  const [activeFollowUp, setActiveFollowUp] = useState<{
    follow_up_id: number;
    question_text: string;
    reply_saved?: boolean;
  } | null>(null);
  const [followUpReply, setFollowUpReply] = useState("");
  const [replying, setReplying] = useState(false);

  async function loadMe() {
    if (!token) {
      navigate("/join");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let data = await api.me(token);
      if (data.pending_follow_ups.length > 0) {
        const first = data.pending_follow_ups[0];
        // Riddle 2: if a reply was saved earlier but processing did not complete, resume it
        if (first.reply_saved) {
          try {
            await api.resumeFollowUp(token, first.follow_up_id);
            data = await api.me(token);
          } catch {
            // Never ask for an already-saved reply again or allow it to be declined.
            setError("Your reply is saved. Finishing it did not complete; please retry below.");
          }
        }
      }
      setInfo(data);
      setActiveFollowUp(data.pending_follow_ups[0] ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, [token]);

  const currentQuestion: StudentQuestion | null = (() => {
    if (!info || !info.quiz || activeFollowUp) return null;
    const answeredSet = new Set(info.answered_question_ids);
    return info.quiz.questions.find((q) => !answeredSet.has(q.question_id)) || null;
  })();

  // Timer setup when question changes
  useEffect(() => {
    if (!currentQuestion) return;
    setElapsedSeconds(0);
    setRanOutOfTime(false);
    if (
      typeof currentQuestion.time_limit_seconds === "number" &&
      currentQuestion.time_limit_seconds > 0
    ) {
      setTimeLeft(currentQuestion.time_limit_seconds);
    } else {
      setTimeLeft(null);
    }
  }, [currentQuestion?.question_id]);

  // Elapsed tracker & Countdown tick
  useEffect(() => {
    if (!currentQuestion || activeFollowUp || submitting) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion?.question_id, activeFollowUp, submitting]);

  // Auto-submit when countdown hits zero
  useEffect(() => {
    if (timeLeft === 0 && currentQuestion && !submitting && !activeFollowUp) {
      handleAutoTimeoutSubmit();
    }
  }, [timeLeft]);

  async function handleAutoTimeoutSubmit() {
    if (!token || !currentQuestion || submitting) return;
    setSubmitting(true);
    setError(null);

    const finalAnswer = answer.trim() || "-";
    const finalExplanation = explanation.trim() || "(Time limit reached)";
    const finalConfidence = (confidence || "unsure") as Confidence;

    try {
      const res = await api.submit(token, {
        question_id: currentQuestion.question_id,
        answer: finalAnswer,
        explanation: finalExplanation,
        self_confidence: finalConfidence,
        time_spent_seconds: currentQuestion.time_limit_seconds || elapsedSeconds,
        timed_out: true,
        ran_out_of_time: true,
      });

      setAnswer("");
      setExplanation("");
      setConfidence("");
      setRanOutOfTime(false);

      if (res.follow_up) {
        setActiveFollowUp(res.follow_up);
      } else {
        const updated = await api.me(token);
        setInfo(updated);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        await loadMe();
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Time expired, but submission encountered an error. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isCompleted =
    info &&
    info.quiz &&
    !activeFollowUp &&
    info.answered_question_ids.length >= info.quiz.questions.length;

  useEffect(() => {
    if (isCompleted) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isCompleted]);

  async function handleSubmitResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !currentQuestion || !confidence || !answer.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.submit(token, {
        question_id: currentQuestion.question_id,
        answer: answer.trim(),
        explanation: explanation.trim(),
        self_confidence: confidence as Confidence,
        time_spent_seconds: elapsedSeconds,
        timed_out: false,
        ran_out_of_time: ranOutOfTime,
      });

      setAnswer("");
      setExplanation("");
      setConfidence("");
      setRanOutOfTime(false);

      if (res.follow_up) {
        setActiveFollowUp(res.follow_up);
      } else {
        const updated = await api.me(token);
        setInfo(updated);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        await loadMe();
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not submit your answer. Please check your connection and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !activeFollowUp || !followUpReply.trim()) return;

    setReplying(true);
    setError(null);

    try {
      await api.reply(token, activeFollowUp.follow_up_id, followUpReply.trim());
      setActiveFollowUp(null);
      setFollowUpReply("");
      const updated = await api.me(token);
      setInfo(updated);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setActiveFollowUp(null);
        await loadMe();
      } else {
        setError(err instanceof Error ? err.message : "Failed to send your reply.");
      }
    } finally {
      setReplying(false);
    }
  }

  async function handleDecline(reason: DeclineReason) {
    if (!token || !activeFollowUp || replying) return;
    setReplying(true);
    setError(null);
    try {
      await api.declineFollowUp(token, activeFollowUp.follow_up_id, reason);
      setFollowUpReply("");
      await loadMe();
    } catch (err: unknown) {
      if (err instanceof ApiError && [0, 408, 409].includes(err.status)) {
        // The choice may have reached the server even if its response was lost.
        await loadMe();
      } else {
        setError(err instanceof Error ? err.message : "Could not save your choice. Please retry.");
      }
    } finally {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner text="Connecting to your class…" variant="ai" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={error} onRetry={loadMe} />
        </div>
      </div>
    );
  }

  if (!info || !info.quiz) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState title="Your teacher hasn't added questions yet.">
          <p>Please check back once your teacher has configured the quiz.</p>
        </EmptyState>
      </div>
    );
  }

  // Done Celebration Screen
  if (isCompleted) {
    return (
      <div className="h-full flex-1 min-h-0 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mx-auto shadow-xl shadow-white/10">
            <CheckCircle2 className="w-9 h-9 text-black" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
              All done — thanks, {info.nickname}!
            </h1>
            <p className="text-zinc-300 text-sm leading-relaxed max-w-sm mx-auto">
              Your explanations will help your teacher understand your thinking and plan the best next
              steps for your learning.
            </p>
          </div>

          <div className="glass-panel-subtle rounded-2xl p-5 border border-white/10 text-xs text-zinc-400">
            <p>You may now close this window or tell your teacher you have finished.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col justify-between w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-4 overflow-hidden">
      {/* Google Classroom-Inspired Assignment Top Bar */}
      <div className="shrink-0 flex items-center justify-between pb-3 border-b border-white/10 gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
            {info.class_name} • Diagnostic Assignment
          </span>
          <h2 className="text-sm sm:text-base font-bold text-white font-heading truncate">
            {info.quiz.title}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-mono font-semibold text-emerald-300">
            Assigned
          </span>
          <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-300">
            {info.nickname}
          </div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 pt-2">
          <ErrorBox message={error} onRetry={() => setError(null)} />
        </div>
      )}

      {/* Main Classroom Split: Left Assignment Navigator (4 cols) + Right Work Area (8 cols) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 overflow-hidden items-start">
        {/* Left Column: Classroom Progress, Steps & Timer (4 Columns) */}
        <div className="hidden lg:flex lg:col-span-4 flex-col space-y-4 h-full overflow-y-auto pr-1">
          {/* Assignment Progress Card */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="font-bold text-white">Classwork Progress</span>
              <span className="text-zinc-300">
                {Math.round((info.answered_question_ids.length / info.quiz.questions.length) * 100)}%
              </span>
            </div>

            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-white transition-all duration-300"
                style={{
                  width: `${(info.answered_question_ids.length / info.quiz.questions.length) * 100}%`,
                }}
              />
            </div>

            <span className="text-[11px] text-zinc-500 block">
              {info.answered_question_ids.length} of {info.quiz.questions.length} questions completed
            </span>
          </div>

          {/* Countdown Timer Widget (when question has time limit) */}
          {timeLeft !== null && (
            <div
              className={`rounded-2xl p-4 border transition-all shrink-0 ${
                timeLeft <= 30
                  ? "border-amber-500/60 bg-amber-950/40 text-amber-200"
                  : "border-white/10 bg-zinc-950/80 text-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Time Remaining
                </span>
                {timeLeft <= 30 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    Expiring soon
                  </span>
                )}
              </div>
              <div className="font-mono text-2xl font-bold tracking-wider mt-1">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                When time expires, your work will be turned in with a timeout record.
              </p>
            </div>
          )}

          {/* Question Sequence Navigator */}
          <div className="glass-panel-subtle rounded-2xl p-4 border border-white/10 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Assignment Questions
            </span>

            <div className="space-y-1.5">
              {info.quiz.questions.map((q) => {
                const isAnswered = info.answered_question_ids.includes(q.question_id);
                const isCurrent = currentQuestion?.question_id === q.question_id;

                return (
                  <div
                    key={q.question_id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      isCurrent
                        ? "bg-white/10 border-white text-white font-medium shadow-sm"
                        : isAnswered
                        ? "bg-zinc-950/60 border-white/5 text-zinc-400"
                        : "bg-zinc-950/30 border-white/5 text-zinc-500"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                          isCurrent
                            ? "bg-white text-black"
                            : isAnswered
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-zinc-900 text-zinc-400"
                        }`}
                      >
                        {isAnswered ? "✓" : `Q${q.position}`}
                      </span>
                      <span className="truncate">{q.prompt}</span>
                    </div>

                    <span className="text-[10px] font-mono shrink-0">
                      {isAnswered ? "Turned In" : isCurrent ? "Active" : "Upcoming"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student Guidance / Privacy Card */}
          <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-3 text-xs text-zinc-400 flex items-start gap-2.5 shrink-0">
            <Shield className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Your explanations are analyzed to help your teacher see your thinking. Mistakes are valuable clues!
            </span>
          </div>
        </div>

        {/* Right Column: Active Question Workspace (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Follow-up question mode */}
          {activeFollowUp ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/20 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 text-white">
                <MessageSquare className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold font-heading text-white">
                  One optional check — not another score
                </h3>
              </div>

              <p className="text-sm font-medium text-zinc-200 leading-relaxed bg-black/60 p-4 rounded-xl border border-white/10">
                "{activeFollowUp.question_text}"
              </p>

              <p className="text-xs text-zinc-400 leading-relaxed">
                A short reply is enough. You can say you are not sure, skip this check, or ask
                to talk with your teacher. None of these choices will change your original answer.
                Your teacher decides what comes next.
              </p>

              {activeFollowUp.reply_saved ? (
                <div role="status" className="space-y-3">
                  <p className="text-sm text-zinc-300">Your reply is saved. No need to answer again.</p>
                  <Button type="button" onClick={loadMe} disabled={replying}>Retry finishing saved reply</Button>
                </div>
              ) : <form onSubmit={handleReplySubmit} className="space-y-4">
                <Textarea
                  label="Your Clarification / Explanation"
                  rows={3}
                  required
                  maxLength={1000}
                  value={followUpReply}
                  onChange={(e) => setFollowUpReply(e.target.value)}
                  placeholder="Share a short reply in your own words…"
                  disabled={replying}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={replying || !followUpReply.trim()}
                  loading={replying}
                  loadingText="Reading your reply…"
                  icon={<Send className="w-3.5 h-3.5" />}
                  className="w-full"
                >
                  Send Clarification
                </Button>
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <Button type="button" variant="outline" disabled={replying} onClick={() => handleDecline("not_sure")}>
                    I’m not sure
                  </Button>
                  <Button type="button" variant="outline" disabled={replying} onClick={() => handleDecline("skip")}>
                    Skip this check
                  </Button>
                  <Button type="button" variant="ghost" disabled={replying} onClick={() => handleDecline("teacher")}>
                    Discuss with my teacher
                  </Button>
                </div>
              </form>}
            </motion.div>
          ) : currentQuestion ? (
            <motion.div
              key={currentQuestion.question_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Question Card & Form */}
              <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Question {currentQuestion.position} of {info.quiz.questions.length}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white font-heading leading-snug">
                      {currentQuestion.prompt}
                    </h3>
                  </div>

                  {timeLeft !== null && (
                    <div
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                        timeLeft <= 30
                          ? "border-amber-500/60 bg-amber-950/40 text-amber-300 animate-pulse"
                          : "border-white/20 bg-zinc-900 text-zinc-200"
                      }`}
                      title="Time limit for this question"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitResponse} id="student-quiz-form" className="space-y-5">
                  {/* Answer Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-2">
                      Your Answer *
                    </label>
                    {currentQuestion.answer_type === "choice" ? (
                      <div className="space-y-2">
                        {currentQuestion.choices.map((choice, idx) => (
                          <label
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              answer === choice
                                ? "border-white bg-white text-black font-semibold shadow-md shadow-white/10"
                                : "border-white/10 bg-zinc-950/60 hover:border-white/20 text-zinc-200"
                            }`}
                          >
                            <input
                              type="radio"
                              name="choice-answer"
                              value={choice}
                              checked={answer === choice}
                              onChange={(e) => setAnswer(e.target.value)}
                              className={answer === choice ? "accent-black" : "accent-white"}
                            />
                            <span className="text-sm font-medium">{choice}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Input
                        required
                        maxLength={100}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Enter your final answer…"
                        disabled={submitting}
                        className="font-mono text-base"
                      />
                    )}
                  </div>

                  {/* Explanation Input */}
                  <div>
                    <Textarea
                      label="Explain Your Reasoning *"
                      rows={3}
                      required
                      maxLength={2000}
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Describe step-by-step how you reached this answer…"
                      disabled={submitting}
                      hint="Write in your own words — your teacher uses this to see how you think."
                    />
                  </div>

                  {/* Confidence Buttons */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-2">
                      How confident are you in this answer? *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: "sure", label: "Sure", desc: "I know this concept" },
                          { value: "unsure", label: "Unsure", desc: "Not completely sure" },
                          { value: "guessed", label: "Guessed", desc: "Just a lucky guess" },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setConfidence(item.value)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            confidence === item.value
                              ? "border-white bg-white text-black shadow-sm font-bold"
                              : "border-white/10 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300"
                          }`}
                        >
                          <span className="block text-xs sm:text-sm font-semibold">{item.label}</span>
                          <span
                            className={`block text-[10px] mt-0.5 ${
                              confidence === item.value ? "text-zinc-700" : "text-zinc-500"
                            }`}
                          >
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Out of Time Fact (Riddle 2) */}
                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-zinc-950/60 hover:border-white/25 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={ranOutOfTime}
                        onChange={(e) => setRanOutOfTime(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white accent-white cursor-pointer"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-zinc-200 block">
                          I ran out of time on this question
                        </span>
                        <span className="text-[11px] text-zinc-400 block">
                          Lets your teacher know that time pressure affected your thinking.
                        </span>
                      </div>
                    </label>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      {currentQuestion && !activeFollowUp && (
        <div className="shrink-0 pt-3 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
            <Brain className="w-3.5 h-3.5 text-zinc-400" />
            <span>AI diagnostic guardrails ready</span>
          </div>

          <Button
            type="submit"
            form="student-quiz-form"
            variant="primary"
            size="md"
            disabled={submitting || !answer.trim() || !explanation.trim() || !confidence}
            loading={submitting}
            loadingText="Evaluating Reasoning…"
            iconRight={<Send className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto px-6"
          >
            Turn In (Submit Answer)
          </Button>
        </div>
      )}
    </div>
  );
}
