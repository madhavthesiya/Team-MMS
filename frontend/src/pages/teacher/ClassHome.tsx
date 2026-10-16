import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTeacherToken } from "../../lib/useTeacherToken";
import { api } from "../../api/client";
import type { ClassInfo } from "../../api/types";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/ErrorBox";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ClassNav } from "../../components/ClassNav";
import { ClassCodeModal } from "../../components/ClassCodeModal";
import {
  BarChart3,
  Edit3,
  Trash2,
  BookOpen,
  AlertTriangle,
  Maximize2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ClassHome() {
  const navigate = useNavigate();
  const { classId, token, error: tokenError } = useTeacherToken();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream" | "classwork">("stream");

  async function loadClass() {
    if (!classId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getClass(classId, token);
      setCls(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load class. Check your teacher link."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (classId && token) {
      loadClass();
    }
  }, [classId, token]);

  async function handleConfirmDelete() {
    if (!classId || !token) return;
    setDeleting(true);
    try {
      await api.deleteClass(classId, token);
      setDeleteModalOpen(false);
      navigate("/");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete class.");
      setDeleting(false);
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  }

  if (tokenError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={tokenError} />
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-zinc-400 hover:text-white">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner text="Loading class details…" variant="ai" />
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox message={error || "Class not found."} onRetry={loadClass} />
        </div>
      </div>
    );
  }

  const origin = window.location.origin;
  const studentJoinLink = `${origin}/join?code=${cls.join_code}`;
  const teacherLink = `${origin}/teacher/${cls.class_id}#${token}`;

  return (
    <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-black">
      {/* Google Classroom-Inspired Class Sub-Navigation Bar */}
      <ClassNav
        classId={cls.class_id}
        className={cls.name}
        token={token || undefined}
        joinCode={cls.join_code}
        activeTab="stream"
        onOpenProjector={() => setProjectorOpen(true)}
      />

      {/* Main Workspace Area (Independently Scrollable Container) */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        <div className="w-full space-y-6">
          {/* Google Classroom Signature Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-2xl">
            {/* Subtle mathematical graph overlay pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-60" />
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-white text-black">
                    BehindTheMark Classroom
                  </span>
                  {cls.is_sample && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-zinc-300 border border-white/20">
                      Sample Dataset
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold font-heading text-white tracking-tight">
                  {cls.name}
                </h1>

                <p className="text-xs sm:text-sm text-zinc-300 flex items-center gap-2">
                  <span>Topic: {cls.quiz?.topic || "Diagnostic Assessment"}</span>
                  <span>•</span>
                  <span>Created {new Date(cls.created_at).toLocaleDateString()}</span>
                </p>
              </div>

              {/* Join Code Display Card on Banner */}
              <div className="shrink-0 flex items-center gap-3 bg-black/80 backdrop-blur-md border border-white/15 px-4 py-3 rounded-xl shadow-lg">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Class Code
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-black tracking-widest text-white">
                    {cls.join_code}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                  <button
                    type="button"
                    onClick={() => setProjectorOpen(true)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black transition-colors cursor-pointer"
                    title="Display Code for Projector Screen"
                    aria-label="Display code in projector view"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(cls.join_code)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy Class Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Filter (Stream vs Classwork view) */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab("stream")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "stream"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              Stream Feed
            </button>
            <button
              onClick={() => setActiveTab("classwork")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "classwork"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              Classwork & Questions ({cls.quiz?.questions.length || 0})
            </button>
          </div>

          {/* 2-Column Classroom Stream Layout */}
          {activeTab === "stream" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Stream Sidebar (w-80 / 4 cols) */}
              <div className="lg:col-span-4 space-y-5">
                {/* Class Code Card (Google Classroom Style) */}
                <div className="glass-panel rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
                      Class Code
                    </span>
                    <button
                      type="button"
                      onClick={() => setProjectorOpen(true)}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Project</span>
                    </button>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-white/10 text-center">
                    <div className="font-mono text-3xl font-black tracking-widest text-white">
                      {cls.join_code}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => setProjectorOpen(true)}
                      leftIcon={<Maximize2 className="w-3.5 h-3.5 text-black" />}
                    >
                      Open Projector Display
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCopyLink(studentJoinLink)}
                      leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    >
                      {copiedLink ? "Student Link Copied!" : "Copy Student Link"}
                    </Button>
                  </div>
                </div>

                {/* Upcoming / Diagnostic Scope Card */}
                <div className="glass-panel-subtle rounded-2xl p-5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <GraduationCap className="w-4 h-4 text-white" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-300">
                      Diagnostic Scope
                    </h3>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                    <p>
                      <strong>Focus:</strong> Cognitive Misconception Detection
                    </p>
                    <p>
                      <strong>Active Quiz:</strong> {cls.quiz?.title || "No quiz assigned"}
                    </p>
                    <p>
                      <strong>Questions:</strong> {cls.quiz?.questions.length || 0} items with self-explanations
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link to={`/teacher/${cls.class_id}/results#${token}`}>
                      <Button variant="outline" size="sm" className="w-full" leftIcon={<BarChart3 className="w-3.5 h-3.5" />}>
                        View Cognitive Results
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Secret Teacher Admin Card */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/10 text-xs text-zinc-400 space-y-3">
                  <div className="flex items-center justify-between text-zinc-300 font-mono text-[11px]">
                    <span>Teacher Admin Key</span>
                    <button
                      onClick={() => setDeleteModalOpen(true)}
                      className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Bookmark your secret teacher URL to access administrative reports and overrides.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-zinc-400 hover:text-white border border-white/5"
                    onClick={() => handleCopyLink(teacherLink)}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                  >
                    Copy Teacher Admin Link
                  </Button>
                </div>
              </div>

              {/* Right Column: Stream Activity Feed (8 cols) */}
              <div className="lg:col-span-8 space-y-5">
                {/* Teacher Announcement / Instructions Card */}
                <div className="glass-panel rounded-2xl p-5 border border-white/10 shadow-lg flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0 font-bold text-xs shadow-sm">
                    AI
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">BehindTheMark Pedagogical Notice</h4>
                      <span className="text-[11px] font-mono text-zinc-400">Riddle 1: The Same Number</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      This diagnostic assessment is calibrated to detect whether students interpret mathematical expressions as relational equivalences or unidirectional operational steps. When students submit, AI analyzes both their numeric answer and written step-by-step reasoning.
                    </p>
                  </div>
                </div>

                {/* Diagnostic Assignment Stream Item (Google Classroom Post Style) */}
                {cls.quiz ? (
                  <div className="glass-panel rounded-2xl border border-white/15 overflow-hidden shadow-xl hover:border-white/25 transition-all">
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-md shrink-0">
                            <BookOpen className="w-5 h-5 text-black" />
                          </div>
                          <div>
                            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                              Diagnostic Assignment
                            </span>
                            <h3 className="text-lg font-bold text-white font-heading mt-0.5">
                              {cls.quiz.title}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                              Topic: {cls.quiz.topic} • {cls.quiz.questions.length} Questions
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20 shrink-0">
                          Active
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-white/10">
                        Students answer each riddle question, explain their reasoning step-by-step, and state their certainty level. The AI engine flags deep misconceptions like Operational Equals Sign, Variable Concatenation, and Additive-vs-Multiplicative Thinking.
                      </p>

                      {/* Assignment Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <Link to={`/teacher/${cls.class_id}/results#${token}`}>
                            <Button variant="primary" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5 text-black" />}>
                              View Results & Misconceptions
                            </Button>
                          </Link>

                          <Link to={`/teacher/${cls.class_id}/quiz#${token}`}>
                            <Button variant="secondary" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
                              Edit in Quiz Studio
                            </Button>
                          </Link>
                        </div>

                        <Link
                          to={`/join?code=${cls.join_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1.5"
                        >
                          <span>Preview as Student</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl p-8 border border-white/10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto flex items-center justify-center text-white">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">No quiz assigned yet</h3>
                      <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                        Add a diagnostic quiz so students can start submitting explanations.
                      </p>
                    </div>
                    <Link to={`/teacher/${cls.class_id}/quiz#${token}`}>
                      <Button variant="primary" size="md" leftIcon={<Edit3 className="w-4 h-4 text-black" />}>
                        Open Quiz Builder
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Classwork & Questions View (Topic and Accordion List) */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-zinc-950/80 p-4 rounded-xl border border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white">Topic: {cls.quiz?.topic || "Diagnostic Reasoning"}</h3>
                  <p className="text-xs text-zinc-400">All questions included in this diagnostic assessment</p>
                </div>
                <Link to={`/teacher/${cls.class_id}/quiz#${token}`}>
                  <Button variant="secondary" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
                    Edit in Studio
                  </Button>
                </Link>
              </div>

              {cls.quiz?.questions.map((q) => {
                const isExpanded = expandedQuestionId === q.question_id;
                return (
                  <div
                    key={q.question_id}
                    className="glass-panel rounded-xl border border-white/10 hover:border-white/20 transition-all overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(isExpanded ? null : q.question_id)}
                      className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white shrink-0">
                          Q{q.position}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{q.prompt}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 font-mono">
                            <span>Ans: <strong className="text-zinc-200">{q.correct_answer}</strong></span>
                            <span>•</span>
                            <span className="capitalize">{q.answer_type}</span>
                            <span>•</span>
                            <span className="text-zinc-300">{q.misconceptions.length} known misconceptions</span>
                          </div>
                        </div>
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3 bg-black/40"
                        >
                          <div>
                            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                              Full Prompt
                            </span>
                            <p className="text-xs text-zinc-200 mt-0.5">{q.prompt}</p>
                          </div>

                          {q.key_idea && (
                            <div className="p-3 rounded-lg bg-zinc-950 border border-white/10">
                              <span className="text-[11px] font-mono text-zinc-400 block mb-1">
                                Key Mathematical Concept:
                              </span>
                              <p className="text-xs text-zinc-300">{q.key_idea}</p>
                            </div>
                          )}

                          {q.misconceptions.length > 0 && (
                            <div>
                              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                                Calibrated Misconceptions:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.misconceptions.map((m, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-lg bg-zinc-950 border border-white/10 text-xs"
                                  >
                                    <div className="font-semibold text-white">{m.label}</div>
                                    <div className="text-zinc-400 text-[11px] mt-0.5">
                                      Signal: {m.signal_text}
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-400 mt-1">
                                      Triggers: {m.trigger_answers.join(", ")}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Classroom Big-Screen Projector Code Modal */}
      <ClassCodeModal
        open={projectorOpen}
        onClose={() => setProjectorOpen(false)}
        className={cls.name}
        joinCode={cls.join_code}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Class"
        description="Are you sure you want to permanently delete this class?"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-200">
              This action cannot be undone. All questions, student responses, diagnostic traces, and
              history will be permanently erased.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              loading={deleting}
              loadingText="Deleting…"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
