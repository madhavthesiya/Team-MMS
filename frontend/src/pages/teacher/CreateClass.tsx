import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { storage } from "../../lib/storage";
import { ErrorBox } from "../../components/ErrorBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  GraduationCap,
  ArrowLeft,
  PlusCircle,
  Sparkles,
  BookOpen,
  Users,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import { motion } from "framer-motion";

const TEMPLATES = [
  { name: "Grade 7 Mathematics", subject: "Fractions & Ratios", section: "Period 1" },
  { name: "Algebra I — Linear Equations", subject: "Mathematics", section: "Period 3" },
  { name: "Grade 8 Pre-Algebra", subject: "Number Sense", section: "Section A" },
  { name: "AP Physics — Forces & Motion", subject: "Physics", section: "Period 4" },
  { name: "Grade 9 Science", subject: "Physical Science", section: "Section B" },
];

export default function CreateClass() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(tpl: (typeof TEMPLATES)[0]) {
    setName(tpl.name);
    setSubject(tpl.subject);
    setSection(tpl.section);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a class name.");
      return;
    }
    if (trimmed.length > 80) {
      setError("Class name cannot exceed 80 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created = await api.createClass(trimmed);
      storage.setTeacherToken(created.class_id, created.teacher_token);
      navigate(`/teacher/${created.class_id}#${created.teacher_token}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create class.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex-1 min-h-0 w-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-between">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Dashboard</span>
          </Link>

          <Link
            to="/teacher/1"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-mono transition-colors"
          >
            <span>Explore Demo Class</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Google Classroom-Inspired Header Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-7 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-60" />
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center shadow-lg shadow-white/10 shrink-0">
                <GraduationCap className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-black">
                    Teacher Cockpit
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-xs text-zinc-400 font-mono">Google Classroom Architecture</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-white tracking-tight mt-0.5">
                  Create a New Classroom Space
                </h1>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 font-mono bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Instant 6-letter student join code</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-6xl mx-auto">
            <ErrorBox message={error} onRetry={() => setError(null)} />
          </div>
        )}

        {/* 2-Column Google Classroom Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Template Selection (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/10 shadow-xl space-y-6"
            >
              <div>
                <h2 className="text-base font-bold text-white font-heading">Classroom Details</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Set up the course title and parameters your students will see when joining.
                </p>
              </div>

              {/* Template Quick Chips */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-zinc-400" />
                  Quick Curriculum Templates
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-left ${
                        name === tpl.name
                          ? "bg-white text-black border-white font-semibold shadow-sm"
                          : "bg-zinc-950/80 hover:bg-zinc-900 border-white/10 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    label="Class Name *"
                    autoFocus
                    maxLength={80}
                    placeholder="e.g. 7B Mathematics, Grade 9 Science"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    hint="Required. Give your class a recognizable name for students."
                  />
                  <div className="flex justify-end -mt-2">
                    <span className="text-[11px] font-mono text-zinc-500">{name.length}/80</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Subject / Topic (Optional)"
                    maxLength={50}
                    placeholder="e.g. Fractions & Decimals"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={loading}
                    hint="Helps organize your diagnostic quiz topics."
                  />

                  <Input
                    label="Section / Period (Optional)"
                    maxLength={30}
                    placeholder="e.g. Period 2, Fall 2026"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    disabled={loading}
                    hint="Class period or section group."
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={loading}
                    disabled={!name.trim()}
                    leftIcon={<PlusCircle className="w-4 h-4" />}
                  >
                    Create Class & Generate Code
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>

          {/* Right Column: Live Card Preview & Pedagogical Guide (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Class Card Preview */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  Live Classroom Card Preview
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                  Student & Teacher View
                </span>
              </div>

              {/* Classroom Card */}
              <div className="rounded-xl overflow-hidden border border-white/15 bg-zinc-950 shadow-2xl transition-all">
                {/* Banner Header */}
                <div className="p-4 bg-gradient-to-r from-zinc-900 to-black border-b border-white/10 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />
                  <div className="relative z-10 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                      {subject || "Diagnostic Class"} {section ? `• ${section}` : ""}
                    </span>
                    <h3 className="text-base font-bold text-white font-heading truncate">
                      {name || "Your Class Name Here"}
                    </h3>
                    <p className="text-[11px] text-zinc-400">Teacher • Classroom Instructor</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 bg-black/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      0 Students enrolled
                    </span>
                    <span className="font-mono text-zinc-300 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[11px]">
                      Code: [PENDING]
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-500 border-t border-white/5 pt-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Diagnostic Quiz will be ready to assign</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BehindTheMark 3-Step Guide */}
            <div className="glass-panel-subtle rounded-2xl p-5 border border-white/10 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-300">
                How It Works In Your Classroom
              </h3>

              <div className="space-y-3 text-xs text-zinc-300">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <strong className="text-white block font-medium">Instant Join Code</strong>
                    <span className="text-zinc-400 text-[11px] leading-relaxed">
                      Share the 6-letter code on the board. Students join with a nickname—no logins or email accounts needed.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <strong className="text-white block font-medium">Step-by-Step Reasoning</strong>
                    <span className="text-zinc-400 text-[11px] leading-relaxed">
                      Students submit their answer, rate their confidence, and explain their mental model in their own words.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <strong className="text-white block font-medium">Differentiated Diagnostics</strong>
                    <span className="text-zinc-400 text-[11px] leading-relaxed">
                      AI guardrails and rules cluster same-score students by underlying misconceptions so you can teach targeted interventions.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
