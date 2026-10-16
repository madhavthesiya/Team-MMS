import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Fingerprint,
  FlaskConical,
  MessageSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { storage } from "../lib/storage";
import { Button } from "../components/ui/Button";
import { ErrorBox } from "../components/ErrorBox";
import { ParticleText } from "../components/ParticleText";
import MagicBento, { type MagicBentoItem } from "../components/MagicBento";

const BENTO_ITEMS: MagicBentoItem[] = [
  {
    title: "Cognitive Analytics",
    description: "Real-time divergence metrics uncovering identical scores with opposite mental models.",
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
    title: "Teacher Cockpit & AI Interventions",
    description: "Evidence trace review, 1-on-1 Socratic desk dialogue scripts, and one-click teacher overrides.",
    visual: "collaboration",
    colSpan: 2,
    rowSpan: 2,
  },
  {
    title: "Riddle 3: Optional Follow-up Checks",
    description: "Short, non-punitive questions that resolve competing stories without grading pressure.",
    visual: "automation",
    colSpan: 2,
    rowSpan: 2,
  },
  {
    title: "Riddle 4: Transfer Verification",
    description: "Re-checks that travel to new situations and last over time — real learning, not memorized tricks.",
    visual: "integration",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    title: "Class-Wide AI Synthesis & Reteach",
    description: "Instant 10-minute warm-up reteach plans and differentiated small groups based on room-wide evidence.",
    visual: "security",
    colSpan: 2,
    rowSpan: 1,
  },
];

const workflow = [
  {
    icon: BookOpen,
    number: "01",
    title: "Start with their thinking",
    text: "Collect an answer, an explanation, and a confidence check. Keep the original student evidence intact.",
  },
  {
    icon: Fingerprint,
    number: "02",
    title: "Consider more than one story",
    text: "A mistaken rule, a misread condition, or time pressure can lead to the same answer. Weigh all stories before deciding.",
  },
  {
    icon: MessageSquare,
    number: "03",
    title: "Ask one useful question",
    text: "When the evidence is ambiguous, offer a short, targeted follow-up. Teacher judgment always remains authoritative.",
  },
  {
    icon: Route,
    number: "04",
    title: "Check that it travelled",
    text: "Re-check later with the same core idea in a new situation and zero hints. Learning only counts when the reasoning holds.",
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
      navigate("/teacher/" + created.class_id + "#" + created.teacher_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create a sample class. Please try again.");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <div className="landing-page space-y-16 sm:space-y-24 py-4 sm:py-8 w-full max-w-[1560px] mx-auto">
      {/* Hero Section with Interactive ParticleText */}
      <section className="hero-grid relative" aria-labelledby="hero-heading">
        <div className="hero-copy relative z-10 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-zinc-900/80 text-zinc-200 text-xs sm:text-sm font-medium backdrop-blur-md shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span className="eyebrow" style={{ textTransform: "none", fontSize: "12px", letterSpacing: "normal" }}>
              A clearer picture of learning • Riddles 1, 2, 3 & 4
            </span>
          </motion.div>

          {/* Interactive Particle Text Canvas Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-xl h-[120px] sm:h-[150px] relative flex items-center select-none"
          >
            <ParticleText
              text="BehindTheMark"
              color="#ffffff"
              highlightColor="#d4d4d8"
              shape="circle"
              intro="gather"
              particleSize={2.4}
              density={3.6}
              glow={true}
              clickBurst={true}
              burstStrength={1.2}
              pointerRepel={45}
              repelRadius={120}
              idleDrift={0.6}
              fontSize="clamp(2.4rem, 6.5vw, 4.2rem)"
              fontWeight={800}
              fontFamily="'Outfit', sans-serif"
              className="w-full h-full"
            />
          </motion.div>

          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight font-heading leading-[1.05] text-white"
          >
            Same score.<br />
            <span className="text-gradient-primary">Different story.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="hero-description text-base sm:text-lg text-zinc-300 max-w-xl leading-relaxed"
          >
            An answer tells you what. A learner’s reasoning helps you understand why.
            Look beyond the mark, explore the evidence, and choose a better next step together.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="hero-actions flex flex-wrap gap-3 pt-2"
          >
            <Button
              size="lg"
              onClick={handleTrySample}
              loading={loadingSample}
              loadingText="Setting up your class…"
              icon={<FlaskConical size={18} aria-hidden="true" />}
              iconRight={<ArrowRight size={18} aria-hidden="true" />}
            >
              Try the sample class
            </Button>
            <Link to="/teacher/new" className="button-link secondary">
              Create a class
            </Link>
          </motion.div>

          <div className="hero-note flex items-center gap-2 text-xs text-zinc-400">
            <Check size={15} className="text-white shrink-0" aria-hidden="true" />
            <span>No account needed. Sample questions, not pre-filled results.</span>
          </div>

          <Link to="/join" className="student-entry block text-xs text-zinc-400 hover:text-white transition-colors">
            Joining your teacher’s class?{" "}
            <span className="text-zinc-200 font-semibold underline underline-offset-4 inline-flex items-center gap-1">
              Enter a join code <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>

          {error && <ErrorBox message={error} onRetry={handleTrySample} />}
        </div>

        {/* Interactive Contrast Duality Card (Asha vs Leo) */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="reasoning-card relative z-10"
          aria-label="How BehindTheMark approaches an answer"
        >
          <div className="reasoning-card-top flex items-center justify-between pb-3 border-b border-white/10">
            <span className="eyebrow flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Cognitive Contrast Case Study
            </span>
            <span className="reasoning-card-icon">
              <MessageSquare size={19} aria-hidden="true" />
            </span>
          </div>

          <div className="reasoning-card-title text-xl font-bold font-heading text-white mt-4">
            Two identical scores on paper.<br />
            <span>Radically different cognitive needs.</span>
          </div>

          {/* Side-by-side interactive student reasoning cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
            {/* Student A */}
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="p-3.5 rounded-xl border border-white/20 bg-zinc-900/80 backdrop-blur-md space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
                    A
                  </span>
                  <span className="text-xs font-bold text-white">Asha</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                  Score: 7/10
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono bg-black/60 p-2 rounded border border-white/10">
                "I converted 1/2 to 2/4, then added 1/4 = 3/4."
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Diagnosis:</span>
                <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
                  Understood (88%)
                </span>
              </div>
            </motion.div>

            {/* Student B */}
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="p-3.5 rounded-xl border border-zinc-700 bg-zinc-950/80 backdrop-blur-md space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs font-bold flex items-center justify-center">
                    B
                  </span>
                  <span className="text-xs font-bold text-zinc-200">Leo</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded">
                  Score: 7/10
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono bg-zinc-900/90 p-2 rounded border border-white/5">
                "1 + 1 is 2 on top, and 2 + 4 is 6 on bottom."
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Diagnosis:</span>
                <span className="font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-600">
                  Adds across (Rule error)
                </span>
              </div>
            </motion.div>
          </div>

          <div className="reasoning-layers space-y-2">
            {[
              { label: "The answer", detail: "What did the learner submit?", icon: BookOpen },
              { label: "The reasoning", detail: "How did they get there?", icon: Fingerprint },
              { label: "The next conversation", detail: "What would help us understand?", icon: MessageSquare },
            ].map(({ label, detail, icon: Icon }, index) => (
              <div key={label} className="reasoning-layer flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/10">
                <div className="layer-icon text-zinc-300">
                  <Icon size={17} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-xs text-white block">{label}</strong>
                  <p className="text-[11px] text-zinc-400 truncate">{detail}</p>
                </div>
                <span className="layer-number font-mono text-[10px] text-zinc-500">0{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="reasoning-card-bottom flex items-center gap-2 text-xs text-zinc-400 pt-3 border-t border-white/10 mt-3">
            <ShieldCheck size={16} className="text-white" aria-hidden="true" />
            <span>Evidence first. Teacher judgment always authoritative.</span>
          </div>
        </motion.aside>
      </section>

      {/* MagicBento 3D Interactive Platform Architecture */}
      <section className="space-y-6 pt-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Platform Architecture
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold font-heading text-white">
            Engineered for Diagnostic Precision
          </h2>
          <p className="text-zinc-400 text-sm max-w-lg mx-auto">
            Interactive cognitive modeling, teacher intervention controls, Riddle 3 follow-ups, and Riddle 4 transfer checks.
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

      {/* 4-Step Methodology Workflow */}
      <section className="workflow-section pt-8 border-t border-white/10" aria-labelledby="workflow-heading">
        <div className="section-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow">A little more understanding</p>
            <h2 id="workflow-heading" className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
              From an answer to a conversation.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
            A focused diagnostic workflow for teachers and learners. Not another automated ranking or verdict.
          </p>
        </div>

        <div className="workflow-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflow.map(({ icon: Icon, number, title, text }) => (
            <motion.article
              key={number}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="workflow-card p-5 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/30 backdrop-blur-md space-y-3 transition-colors"
            >
              <div className="workflow-card-top flex items-center justify-between text-zinc-300">
                <Icon size={21} aria-hidden="true" />
                <span className="font-mono text-xs text-zinc-500">{number}</span>
              </div>
              <h3 className="text-base font-semibold text-white font-heading">{title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Quick Start Walkthrough Guide */}
      <section className="quick-start p-6 sm:p-8 rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-md" aria-labelledby="start-heading">
        <div className="quick-start-intro space-y-3 mb-6">
          <span className="section-icon inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white text-black shadow-md">
            <Users size={22} aria-hidden="true" />
          </span>
          <p className="eyebrow">Two sides of one classroom</p>
          <h2 id="start-heading" className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Try the complete flow in 1 minute.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
            Open the teacher view here and join as a learner in a second tab or on your phone to see live evidence reconciliation.
          </p>
        </div>

        <ol className="quick-start-steps grid grid-cols-1 md:grid-cols-3 gap-4 list-none p-0 m-0">
          <li className="flex items-start gap-3 p-4 rounded-xl bg-black/50 border border-white/10">
            <span className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs shrink-0">
              1
            </span>
            <div>
              <h3 className="text-sm font-semibold text-white font-heading">Create a sample class</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Click try sample to load a fractions quiz and join code. Responses begin empty.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-4 rounded-xl bg-black/50 border border-white/10">
            <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              2
            </span>
            <div>
              <h3 className="text-sm font-semibold text-white font-heading">Answer in your own words</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Join with a nickname, share your thinking, rate confidence, and answer an optional check.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-4 rounded-xl bg-black/50 border border-white/10">
            <span className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs shrink-0">
              3
            </span>
            <div>
              <h3 className="text-sm font-semibold text-white font-heading">Review the evidence</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Return to the teacher cockpit to inspect cognitive stories, desk interventions, and reteach plans.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Ethical Privacy Guarantee */}
      <div className="privacy-note flex items-center gap-3 p-4 rounded-xl bg-zinc-950/60 border border-white/10 text-xs text-zinc-400">
        <ShieldCheck size={18} className="text-white shrink-0" aria-hidden="true" />
        <p>
          Student privacy by design: Use nicknames and avoid personal details. Evidence is evaluated to assist teacher instructional decisions, never to automate student grades.
        </p>
      </div>
    </div>
  );
}
