import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { storage } from "../lib/storage";
import { Spinner } from "../components/Spinner";
import { ErrorBox } from "../components/ErrorBox";
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  Users,
  FlaskConical,
} from "lucide-react";
import { motion } from "framer-motion";

import { ParticleText } from "../components/ParticleText";
import MagicBento, { type MagicBentoItem } from "../components/MagicBento";

const BENTO_ITEMS: MagicBentoItem[] = [
  {
    title: "Cognitive Analytics",
    description: "Real-time divergence metrics uncovering identical scores with opposite reasoning.",
    visual: "analytics",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    title: "Diagnostic Dashboard",
    description: "Partitioning student answers into understood, careless slips, and deep misconceptions.",
    visual: "dashboard",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    title: "Teacher Cockpit",
    description: "Evidence trace review, private coaching notes, and one-click diagnostic overrides.",
    visual: "collaboration",
    colSpan: 2,
    rowSpan: 2,
  },
  {
    title: "AI Analysis Engine",
    description: "Step-by-step reasoning diagnosis with pedagogical fallback guardrails.",
    visual: "automation",
    colSpan: 2,
    rowSpan: 2,
  },
  {
    title: "Classroom Workflow",
    description: "Google Classroom compatible codes, big-screen projector view, and instant student links.",
    visual: "integration",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    title: "Privacy & Guardrails",
    description: "Nickname-only student assessment with zero PII storage and ethical AI limits.",
    visual: "security",
    colSpan: 2,
    rowSpan: 1,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrySample() {
    setLoadingSample(true);
    setError(null);
    try {
      const created = await api.createSampleClass();
      storage.setTeacherToken(created.class_id, created.teacher_token);
      navigate(`/teacher/${created.class_id}#${created.teacher_token}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create sample class. Please try again."
      );
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <div className="space-y-12 sm:space-y-16 py-4 sm:py-8 max-w-5xl mx-auto">
      {/* Hero Section with Interactive ParticleText */}
      <section className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-zinc-900/80 text-zinc-200 text-xs sm:text-sm font-medium backdrop-blur-md shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-white" />
          <span>Learning Theme: Riddle 1 — "The Same Number"</span>
        </motion.div>

        {/* Interactive Particle Text Canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl mx-auto h-[130px] sm:h-[170px] relative flex items-center justify-center select-none"
        >
          <ParticleText
            text="BehindTheMark"
            color="#ffffff"
            highlightColor="#d4d4d8"
            shape="circle"
            intro="gather"
            particleSize={2.2}
            density={3.5}
            glow={true}
            clickBurst={true}
            burstStrength={1.2}
            pointerRepel={45}
            repelRadius={120}
            idleDrift={0.6}
            fontSize="clamp(2.4rem, 7vw, 4.4rem)"
            fontWeight={800}
            fontFamily="'Outfit', sans-serif"
            className="w-full h-full min-h-[130px] sm:min-h-[170px]"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-2xl sm:text-4xl font-extrabold tracking-tight font-heading leading-tight text-white"
        >
          Same score. <span className="text-gradient-primary">Different story.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-300 leading-relaxed"
        >
          Two students both get 7/10. One understood the concept but made a careless slip; the other
          pattern-matched or guessed. BehindTheMark asks students to explain, analyzes their
          reasoning with AI guardrails, and shows the teacher <em className="text-white font-semibold">why</em> — so each gets the right next step.
        </motion.p>

        {/* Primary CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2 max-w-md mx-auto sm:max-w-none"
        >
          <button
            onClick={handleTrySample}
            disabled={loadingSample}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm sm:text-base shadow-[0_0_25px_rgba(255,255,255,0.18)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Try the sample class</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          <Link
            to="/teacher/new"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-white font-medium text-sm sm:text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <GraduationCap className="w-4 h-4 text-zinc-300" />
            <span>Create a class</span>
          </Link>

          <Link
            to="/join"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-800 bg-black/60 hover:bg-zinc-900 text-zinc-300 hover:text-white font-medium text-sm sm:text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-zinc-400" />
            <span>Join as a student</span>
          </Link>
        </motion.div>

        {loadingSample && (
          <Spinner
            text="Setting up the sample class…"
            subtext="Loading pre-configured fractions quiz with known misconceptions"
            variant="ai"
          />
        )}

        {error && <ErrorBox message={error} onRetry={handleTrySample} />}
      </section>

      {/* Interactive Visual Comparison of Riddle 1 */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            How BehindTheMark Works
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white mt-1">
            Two identical scores on paper — radically different needs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Student A */}
          <motion.div
            whileHover={{ y: -3 }}
            className="rounded-xl border border-white/20 bg-zinc-900/60 p-5 backdrop-blur-md relative shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shadow-sm">
                  A
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Asha</h3>
                  <span className="text-[11px] text-zinc-400">Question: 1/2 + 1/4</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white font-mono">Score: 7/10</span>
                <span className="block text-[10px] text-zinc-400">Answer: 3/4 (Correct)</span>
              </div>
            </div>

            <div className="bg-black/60 rounded-lg p-3 my-3 text-xs text-zinc-200 border border-white/10 font-mono">
              <span className="text-zinc-500">Explanation: </span>
              "I converted 1/2 into 2/4 and then added 1/4 to get 3/4."
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-zinc-400">AI Reading:</span>
              <span className="px-2.5 py-1 rounded-full bg-white text-black font-bold text-[11px] shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                Understood (88% confidence)
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-300">
              Teacher action: Ready for multi-step fraction operations.
            </p>
          </motion.div>

          {/* Student B */}
          <motion.div
            whileHover={{ y: -3 }}
            className="rounded-xl border border-zinc-700 bg-black/70 p-5 backdrop-blur-md relative shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center font-bold text-zinc-200 text-xs">
                  B
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Leo</h3>
                  <span className="text-[11px] text-zinc-400">Question: 1/2 + 1/4</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-zinc-300 font-mono">Score: 7/10</span>
                <span className="block text-[10px] text-zinc-500">Answer: 2/6</span>
              </div>
            </div>

            <div className="bg-zinc-950 rounded-lg p-3 my-3 text-xs text-zinc-300 border border-white/5 font-mono">
              <span className="text-zinc-500">Explanation: </span>
              "1 + 1 is 2 on top, and 2 + 4 is 6 on bottom."
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-zinc-400">AI Reading:</span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-100 border border-zinc-400 font-semibold text-[11px]">
                Misconception: Adds tops and bottoms
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Teacher action: Visual fraction strips remedy recommended.
            </p>
          </motion.div>
        </div>
      </section>

      {/* MagicBento Platform Capabilities */}
      <section className="space-y-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Platform Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
            Engineered for Diagnostic Precision
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
            Interactive cognitive modeling, teacher intervention controls, and classroom-ready workflows.
          </p>
        </div>

        <MagicBento
          items={BENTO_ITEMS}
          columns={4}
          rowHeight={190}
          gap={14}
          radius={20}
          theme="dark"
          enableStars={true}
          enableSpotlight={true}
          enableBorderGlow={true}
          enableTilt={true}
        />
      </section>

      {/* 1-Minute Walkthrough Guide */}
      <section className="space-y-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Quick Start
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
            How to try it in 1 minute
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Experience both the teacher and student workflows in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel-subtle rounded-xl p-5 border border-white/10 hover:border-white/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm mb-3 shadow-sm">
              1
            </div>
            <h3 className="font-semibold text-white text-base font-heading">Try the sample class</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Click the sample button above. It pre-loads a validated fractions quiz with 4 diagnostic
              questions and predefined misconception triggers.
            </p>
          </div>

          <div className="glass-panel-subtle rounded-xl p-5 border border-white/10 hover:border-white/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-600 text-white flex items-center justify-center font-bold text-sm mb-3">
              2
            </div>
            <h3 className="font-semibold text-white text-base font-heading">Answer as a student</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Open the student join link in a private window or on your phone. Submit an answer, write
              your explanation, and rate your confidence.
            </p>
          </div>

          <div className="glass-panel-subtle rounded-xl p-5 border border-white/10 hover:border-white/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-sm mb-3">
              3
            </div>
            <h3 className="font-semibold text-white text-base font-heading">Inspect live results</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Return to the teacher dashboard. See students grouped by reason, inspect AI reasoning
              hypotheses, view traces, or override readings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
