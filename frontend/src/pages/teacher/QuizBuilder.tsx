import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeacherToken } from "../../lib/useTeacherToken";
import { api, ApiError } from "../../api/client";
import type { AnswerType, QuestionIn, QuizIn, AIGenerateQuestionOut } from "../../api/types";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/ErrorBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { ClassNav } from "../../components/ClassNav";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Save,
  CheckCircle2,
  Lightbulb,
  ListPlus,
  Layers,
  X,
  Wand2,
} from "lucide-react";

interface QuestionFormState extends Omit<QuestionIn, "misconceptions"> {
  misconceptions: {
    label: string;
    triggersText: string;
    signal_text: string;
    remedy_hint: string;
  }[];
}

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { classId, token, error: tokenError } = useTeacherToken();

  const [topic, setTopic] = useState("Mathematics");
  const [title, setTitle] = useState("Diagnostic Quiz");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<"list" | "edit">("edit");

  const [questions, setQuestions] = useState<QuestionFormState[]>([
    {
      prompt: "What is 1/2 + 1/4?",
      correct_answer: "3/4",
      answer_type: "number",
      key_idea: "Find a common denominator: 1/2 = 2/4, so 2/4 + 1/4 = 3/4.",
      choices: [],
      misconceptions: [
        {
          label: "Adds tops and bottoms",
          triggersText: "2/6",
          signal_text: "Adds numerators and denominators separately",
          remedy_hint: "Use fraction strips to show why denominators must be equal first",
        },
      ],
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Question Generator Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGradeLevel, setAiGradeLevel] = useState("Middle School");
  const [aiFocus, setAiFocus] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIGenerateQuestionOut | null>(null);

  async function handleAIGenerate() {
    if (!classId || !token) return;
    const targetTopic = (aiTopic || topic).trim();
    if (!targetTopic) {
      setAiGenError("Please provide a topic for the AI to analyze.");
      return;
    }
    setAiGenerating(true);
    setAiGenError(null);
    try {
      const generated = await api.aiGenerateQuestion(classId, token, {
        topic: targetTopic,
        grade_level: aiGradeLevel,
        misconception_focus: aiFocus.trim(),
      });
      setAiResult(generated);
    } catch (err: unknown) {
      setAiGenError(err instanceof Error ? err.message : "Failed to generate diagnostic question.");
    } finally {
      setAiGenerating(false);
    }
  }

  function applyGeneratedQuestion(mode: "new" | "replace") {
    if (!aiResult) return;
    const formatted: QuestionFormState = {
      prompt: aiResult.prompt,
      correct_answer: aiResult.correct_answer,
      answer_type: aiResult.answer_type,
      key_idea: aiResult.key_idea,
      choices: aiResult.choices || [],
      time_limit_seconds: aiResult.time_limit_seconds || 90,
      misconceptions: aiResult.misconceptions.map((m) => ({
        label: m.label,
        triggersText: m.trigger_answers.join(", "),
        signal_text: m.signal_text,
        remedy_hint: m.remedy_hint,
      })),
    };

    if (mode === "new") {
      const nextQuestions = [...questions, formatted];
      setQuestions(nextQuestions);
      setActiveQuestionIndex(nextQuestions.length - 1);
    } else {
      const nextQuestions = [...questions];
      nextQuestions[activeQuestionIndex] = formatted;
      setQuestions(nextQuestions);
    }
    setAiModalOpen(false);
    setAiResult(null);
    setMobileTab("edit");
  }

  useEffect(() => {
    async function init() {
      if (!classId || !token) return;
      try {
        const cls = await api.getClass(classId, token);
        if (cls.quiz) {
          setTopic(cls.quiz.topic);
          setTitle(cls.quiz.title);
          if (cls.quiz.questions.length > 0) {
            setQuestions(
              cls.quiz.questions.map((q) => ({
                prompt: q.prompt,
                correct_answer: q.correct_answer,
                answer_type: q.answer_type,
                key_idea: q.key_idea,
                choices: q.choices || [],
                misconceptions: q.misconceptions.map((m) => ({
                  label: m.label,
                  triggersText: m.trigger_answers.join(", "),
                  signal_text: m.signal_text,
                  remedy_hint: m.remedy_hint,
                })),
              }))
            );
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load quiz.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [classId, token]);

  function addQuestion() {
    if (questions.length >= 20) {
      alert("Maximum 20 questions allowed per quiz.");
      return;
    }
    const nextQuestions = [
      ...questions,
      {
        prompt: "",
        correct_answer: "",
        answer_type: "number" as AnswerType,
        key_idea: "",
        choices: [],
        misconceptions: [],
      },
    ];
    setQuestions(nextQuestions);
    setActiveQuestionIndex(nextQuestions.length - 1);
    setMobileTab("edit");
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) {
      alert("A quiz must have at least one question.");
      return;
    }
    const nextQuestions = questions.filter((_, i) => i !== index);
    setQuestions(nextQuestions);
    if (activeQuestionIndex >= nextQuestions.length) {
      setActiveQuestionIndex(Math.max(0, nextQuestions.length - 1));
    }
  }

  function moveQuestion(index: number, direction: "up" | "down", e?: React.MouseEvent) {
    e?.stopPropagation();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const newQuestions = [...questions];
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;
    setQuestions(newQuestions);
    if (activeQuestionIndex === index) {
      setActiveQuestionIndex(targetIndex);
    } else if (activeQuestionIndex === targetIndex) {
      setActiveQuestionIndex(index);
    }
  }

  function updateActiveQuestion(patch: Partial<QuestionFormState>) {
    const updated = [...questions];
    updated[activeQuestionIndex] = { ...updated[activeQuestionIndex], ...patch };
    setQuestions(updated);
  }

  function addChoice() {
    const q = questions[activeQuestionIndex];
    if (q.choices.length >= 6) {
      alert("Maximum 6 choices allowed per question.");
      return;
    }
    updateActiveQuestion({ choices: [...q.choices, ""] });
  }

  function updateChoice(choiceIndex: number, val: string) {
    const q = questions[activeQuestionIndex];
    const newChoices = [...q.choices];
    newChoices[choiceIndex] = val;
    updateActiveQuestion({ choices: newChoices });
  }

  function removeChoice(choiceIndex: number) {
    const q = questions[activeQuestionIndex];
    const removedChoice = q.choices[choiceIndex];
    const newChoices = q.choices.filter((_, i) => i !== choiceIndex);
    const patch: Partial<QuestionFormState> = { choices: newChoices };
    if (q.correct_answer === removedChoice) {
      patch.correct_answer = "";
    }
    updateActiveQuestion(patch);
  }

  function addMisconception() {
    const q = questions[activeQuestionIndex];
    if (q.misconceptions.length >= 6) {
      alert("Maximum 6 misconceptions allowed per question.");
      return;
    }
    updateActiveQuestion({
      misconceptions: [
        ...q.misconceptions,
        { label: "", triggersText: "", signal_text: "", remedy_hint: "" },
      ],
    });
  }

  function removeMisconception(mIndex: number) {
    const q = questions[activeQuestionIndex];
    updateActiveQuestion({
      misconceptions: q.misconceptions.filter((_, i) => i !== mIndex),
    });
  }

  function updateMisconception(
    mIndex: number,
    patch: Partial<QuestionFormState["misconceptions"][0]>
  ) {
    const q = questions[activeQuestionIndex];
    const updated = [...q.misconceptions];
    updated[mIndex] = { ...updated[mIndex], ...patch };
    updateActiveQuestion({ misconceptions: updated });
  }

  async function handleSave() {
    if (!classId || !token) return;
    setError(null);

    if (!topic.trim()) {
      setError("Please specify a topic.");
      return;
    }
    if (!title.trim()) {
      setError("Please specify a quiz title.");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        setError(`Question ${i + 1} prompt cannot be empty.`);
        setActiveQuestionIndex(i);
        setMobileTab("edit");
        return;
      }
      if (!q.correct_answer.trim()) {
        setError(`Question ${i + 1} requires a correct answer.`);
        setActiveQuestionIndex(i);
        setMobileTab("edit");
        return;
      }
      if (!q.key_idea.trim()) {
        setError(`Question ${i + 1} requires a key idea.`);
        setActiveQuestionIndex(i);
        setMobileTab("edit");
        return;
      }
      if (q.answer_type === "choice") {
        if (q.choices.length < 2) {
          setError(`Question ${i + 1} (multiple choice) requires at least 2 choices.`);
          setActiveQuestionIndex(i);
          setMobileTab("edit");
          return;
        }
        if (!q.choices.includes(q.correct_answer)) {
          setError(
            `Question ${i + 1}: The correct answer must be one of the listed choices.`
          );
          setActiveQuestionIndex(i);
          setMobileTab("edit");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: QuizIn = {
        topic: topic.trim(),
        title: title.trim(),
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          correct_answer: q.correct_answer.trim(),
          answer_type: q.answer_type,
          key_idea: q.key_idea.trim(),
          choices: q.answer_type === "choice" ? q.choices.map((c) => c.trim()).filter(Boolean) : [],
          misconceptions: q.misconceptions
            .filter((m) => m.label.trim())
            .map((m) => ({
              label: m.label.trim(),
              trigger_answers: m.triggersText
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              signal_text: m.signal_text.trim(),
              remedy_hint: m.remedy_hint.trim(),
            })),
        })),
      };

      await api.saveQuiz(classId, token, payload);
      navigate(`/teacher/${classId}#${token}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Students have already answered — this quiz is locked from editing.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save quiz.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (tokenError) return <ErrorBox message={tokenError} />;
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner text="Loading quiz in Studio…" variant="ai" />
      </div>
    );
  }

  const activeQ = questions[activeQuestionIndex] || questions[0];

  return (
    <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-black">
      {/* Studio Header Bar */}
      {/* Google Classroom-Inspired Class Sub-Navigation Bar */}
      <ClassNav
        classId={classId!}
        className={title || "Quiz Builder & Questions"}
        token={token || undefined}
        activeTab="classwork"
      />

      {/* Action Strip */}
      <div className="shrink-0 border-b border-white/10 bg-zinc-950/60 px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded shrink-0">
            {topic}
          </span>
          <span className="text-xs text-zinc-400 hidden sm:inline">
            {questions.length} questions in diagnostic quiz
          </span>
        </div>

        {/* Save & AI Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAiTopic(topic);
              setAiModalOpen(true);
            }}
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            className="border border-violet-500/30 bg-violet-950/20 hover:bg-violet-900/30 text-violet-200"
          >
            AI Generator
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
            loadingText="Saving Quiz…"
            icon={<Save className="w-3.5 h-3.5" />}
          >
            Save Quiz
          </Button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden shrink-0 border-b border-white/10 bg-zinc-950 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setMobileTab("list")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === "list" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
          }`}
        >
          Questions ({questions.length})
        </button>
        <button
          onClick={() => setMobileTab("edit")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            mobileTab === "edit" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
          }`}
        >
          Editing Q{activeQuestionIndex + 1}
        </button>
      </div>

      {/* Main Studio Split Layout */}
      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        {/* Left Pane: Question Navigator */}
        <div
          className={`w-full md:w-80 shrink-0 border-r border-white/10 bg-zinc-950/60 flex flex-col min-h-0 ${
            mobileTab === "edit" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Navigator Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                Questions ({questions.length}/20)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAiTopic(topic);
                  setAiModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-sm transition-all cursor-pointer"
                title="Generate with Gemini & Groq"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>AI</span>
              </button>
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-white hover:bg-zinc-200 text-black font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Quiz Settings Mini Panel */}
          <div className="p-3 border-b border-white/10 bg-black/40 space-y-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-white outline-none focus:border-white"
                  placeholder="e.g. Fractions"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-white outline-none focus:border-white"
                  placeholder="e.g. Fractions Quiz"
                />
              </div>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
            {questions.map((q, idx) => {
              const isActive = idx === activeQuestionIndex;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveQuestionIndex(idx);
                    setMobileTab("edit");
                  }}
                  className={`group relative rounded-xl p-3 border transition-all cursor-pointer select-none ${
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
                        {idx + 1}
                      </span>
                      <p className="text-xs font-medium truncate">
                        {q.prompt.trim() || <span className="italic text-zinc-500">Untitled Question</span>}
                      </p>
                    </div>

                    {/* Reorder and Delete Controls */}
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => moveQuestion(idx, "up", e)}
                        disabled={idx === 0}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => moveQuestion(idx, "down", e)}
                        disabled={idx === questions.length - 1}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQuestion(idx);
                        }}
                        disabled={questions.length <= 1}
                        className="p-1 text-zinc-400 hover:text-red-400 disabled:opacity-20 cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-400">
                    <span className="capitalize font-mono">{q.answer_type}</span>
                    <span>•</span>
                    <span className="font-mono text-zinc-300">Ans: {q.correct_answer || "—"}</span>
                    {q.misconceptions.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-400">
                          {q.misconceptions.length} misc
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Active Question Editor */}
        <div
          className={`flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 ${
            mobileTab === "list" ? "hidden md:block" : "block"
          }`}
        >
          {error && <ErrorBox message={error} onRetry={() => setError(null)} />}

          {/* Active Question Banner & Controls */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm font-mono">
                {activeQuestionIndex + 1}
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                  Question {activeQuestionIndex + 1} of {questions.length}
                </h2>
                <p className="text-xs text-zinc-400">
                  Configure prompt, expected answer, key mathematical concept, and diagnostic misconceptions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveQuestion(activeQuestionIndex, "up")}
                disabled={activeQuestionIndex === 0}
                icon={<ChevronUp className="w-3.5 h-3.5" />}
              >
                Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveQuestion(activeQuestionIndex, "down")}
                disabled={activeQuestionIndex === questions.length - 1}
                icon={<ChevronDown className="w-3.5 h-3.5" />}
              >
                Down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(activeQuestionIndex)}
                disabled={questions.length <= 1}
                icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Question Prompt & Answer Section */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
            <Textarea
              label="Question Prompt"
              value={activeQ.prompt}
              onChange={(e) => updateActiveQuestion({ prompt: e.target.value })}
              placeholder="e.g. What is 1/2 + 1/4? Explain your reasoning."
              rows={3}
              hint="Write a clear question prompt that invites self-explanation."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-2">
                  Answer Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-white/10">
                  {(["number", "text", "choice"] as AnswerType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const patch: Partial<QuestionFormState> = { answer_type: type };
                        if (type === "choice" && activeQ.choices.length === 0) {
                          patch.choices = ["Option A", "Option B"];
                        }
                        updateActiveQuestion(patch);
                      }}
                      className={`text-xs font-medium py-2 rounded-lg capitalize transition-all cursor-pointer ${
                        activeQ.answer_type === type
                          ? "bg-white text-black font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Input
                  label="Correct Answer"
                  value={activeQ.correct_answer}
                  onChange={(e) => updateActiveQuestion({ correct_answer: e.target.value })}
                  placeholder={
                    activeQ.answer_type === "choice"
                      ? "Select or enter correct choice below"
                      : "e.g. 3/4 or 0.75"
                  }
                  hint="The canonical correct response against which explanations are calibrated."
                />
              </div>
            </div>

            {/* Multiple Choice Options Editor */}
            {activeQ.answer_type === "choice" && (
              <div className="pt-2 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
                    <ListPlus className="w-3.5 h-3.5 text-zinc-400" />
                    Choices ({activeQ.choices.length}/6)
                  </span>
                  <button
                    type="button"
                    onClick={addChoice}
                    className="text-xs text-white hover:text-zinc-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Choice</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {activeQ.choices.map((choice, cIdx) => {
                    const isCorrect = choice.trim() && choice === activeQ.correct_answer;
                    return (
                      <div key={cIdx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateActiveQuestion({ correct_answer: choice })}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-all cursor-pointer ${
                            isCorrect
                              ? "bg-white text-black border-white"
                              : "border-white/20 hover:border-white text-transparent"
                          }`}
                          title="Set as correct answer"
                        >
                          <CheckCircle2 className="w-4 h-4 fill-current" />
                        </button>
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => updateChoice(cIdx, e.target.value)}
                          placeholder={`Choice ${String.fromCharCode(65 + cIdx)}`}
                          className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeChoice(cIdx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove choice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Key Mathematical Idea */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold font-heading text-white">
                Key Mathematical Concept / Idea
              </h3>
            </div>
            <Textarea
              value={activeQ.key_idea}
              onChange={(e) => updateActiveQuestion({ key_idea: e.target.value })}
              placeholder="e.g. Adding fractions requires a common denominator so that fractional units are equivalent before adding numerators."
              rows={3}
              hint="The AI evaluation model uses this reference concept to verify conceptual understanding."
            />
          </div>

          {/* Known Misconceptions & AI Signal Triggers */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  Known Misconceptions & AI Triggers
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Pre-specify known faulty mental models to instantly match student explanations.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={addMisconception}
                disabled={activeQ.misconceptions.length >= 6}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Misconception
              </Button>
            </div>

            {activeQ.misconceptions.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                <p className="text-xs text-zinc-400">
                  No specific misconceptions added yet for this question.
                </p>
                <button
                  type="button"
                  onClick={addMisconception}
                  className="mt-2 text-xs text-white hover:text-zinc-300 font-semibold underline underline-offset-4 cursor-pointer"
                >
                  + Add an anticipated misconception
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeQ.misconceptions.map((m, mIdx) => (
                  <div
                    key={mIdx}
                    className="p-4 rounded-xl border border-white/10 bg-zinc-950/70 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px]">
                          {mIdx + 1}
                        </span>
                        Misconception #{mIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMisconception(mIdx)}
                        className="p-1 text-zinc-400 hover:text-red-400 cursor-pointer"
                        title="Delete misconception"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Label / Name"
                        value={m.label}
                        onChange={(e) => updateMisconception(mIdx, { label: e.target.value })}
                        placeholder="e.g. Adds tops and bottoms"
                      />
                      <Input
                        label="Trigger Answers (comma-separated)"
                        value={m.triggersText}
                        onChange={(e) => updateMisconception(mIdx, { triggersText: e.target.value })}
                        placeholder="e.g. 2/6, 2/4"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Textarea
                        label="AI Signal Text (What student says)"
                        value={m.signal_text}
                        onChange={(e) => updateMisconception(mIdx, { signal_text: e.target.value })}
                        placeholder="e.g. Added 1+1=2 on top and 2+4=6 on bottom"
                        rows={2}
                      />
                      <Textarea
                        label="Pedagogical Remedy Hint"
                        value={m.remedy_hint}
                        onChange={(e) => updateMisconception(mIdx, { remedy_hint: e.target.value })}
                        placeholder="e.g. Use visual fraction circles to prove 2/6 is smaller than 1/2"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Question Generator Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950 border border-violet-500/30 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    AI Conceptual Question Generator
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Gemini + Groq
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Generates diagnostic questions with cognitive distractors & researched misconceptions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {aiGenError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                  {aiGenError}
                </div>
              )}

              {/* Input Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Learning Objective / Topic *"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="e.g. Newton's Third Law & Normal Force"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Target Level
                    </label>
                    <select
                      value={aiGradeLevel}
                      onChange={(e) => setAiGradeLevel(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    >
                      <option value="Elementary (Grades 3-5)">Elementary (Grades 3-5)</option>
                      <option value="Middle School (Grades 6-8)">Middle School (Grades 6-8)</option>
                      <option value="High School (Grades 9-12)">High School (Grades 9-12)</option>
                      <option value="College / Advanced">College / Advanced</option>
                    </select>
                  </div>
                </div>

                <Textarea
                  label="Specific Cognitive Trap / Misconception to Target (Optional)"
                  value={aiFocus}
                  onChange={(e) => setAiFocus(e.target.value)}
                  placeholder="e.g. Students confuse normal force with gravitational reaction force, or assume heavy objects fall faster"
                  rows={2}
                />

                <div className="flex justify-end pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAIGenerate}
                    loading={aiGenerating}
                    loadingText="Generating Pedagogical Question…"
                    icon={<Wand2 className="w-4 h-4" />}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                  >
                    Generate Diagnostic Question
                  </Button>
                </div>
              </div>

              {/* Result Preview */}
              {aiResult && (
                <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-violet-500/20 pb-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-violet-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                      Generated Diagnostic Question
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Type: {aiResult.answer_type} • Timer: {aiResult.time_limit_seconds}s
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-0.5">Prompt:</span>
                    <p className="text-sm font-medium text-white leading-relaxed">{aiResult.prompt}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-0.5">Correct Answer:</span>
                      <span className="font-semibold text-white">{aiResult.correct_answer}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-indigo-400 block mb-0.5">Key Concept Idea:</span>
                      <span className="text-zinc-300">{aiResult.key_idea}</span>
                    </div>
                  </div>

                  {aiResult.misconceptions && aiResult.misconceptions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono uppercase text-amber-400 block">
                        Diagnostic Misconceptions ({aiResult.misconceptions.length}):
                      </span>
                      <div className="space-y-1.5">
                        {aiResult.misconceptions.map((m, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{m.label}</span>
                              <span className="text-[10px] font-mono text-amber-300">
                                Triggers: {m.trigger_answers.join(", ") || "n/a"}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 italic">Signal: "{m.signal_text}"</p>
                            <p className="text-[11px] text-zinc-300">💡 Remedy: {m.remedy_hint}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-violet-500/20">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyGeneratedQuestion("replace")}
                    >
                      Replace Current Q{activeQuestionIndex + 1}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => applyGeneratedQuestion("new")}
                      className="bg-violet-600 hover:bg-violet-500"
                    >
                      Insert as New Question
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
