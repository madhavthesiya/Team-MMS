import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { storage } from "../../lib/storage";
import { ErrorBox } from "../../components/ErrorBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Users,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
  HelpCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setCode(codeParam.toUpperCase().trim());
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanCode = code.toUpperCase().trim();
    const cleanNickname = nickname.trim();

    if (!cleanCode) {
      setError("Please enter the 6-character class join code.");
      return;
    }
    if (!cleanNickname) {
      setError("Please enter a nickname.");
      return;
    }
    if (cleanNickname.length > 30) {
      setError("Nickname must be 30 characters or fewer.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.join(cleanCode, cleanNickname);
      storage.setStudentToken(res.student_token);
      navigate("/student");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setError("No class found with that code. Please double-check with your teacher.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to join class. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex-1 min-h-0 w-full overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 flex flex-col justify-between">
      <div className="w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </Link>

          <span className="text-xs font-mono text-zinc-400">
            Student Diagnostic Portal
          </span>
        </div>

        {/* Google Classroom Student Header Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-7 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-60" />
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center shadow-lg shadow-white/10 shrink-0">
                <Users className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-black">
                    Student Space
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-xs text-zinc-400 font-mono">No Passwords Required</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-white tracking-tight mt-0.5">
                  Join Your Class Session
                </h1>
              </div>
            </div>

          </div>
        </div>

        {error && (
          <div className="w-full">
            <ErrorBox message={error} onRetry={() => setError(null)} />
          </div>
        )}

        {/* 2-Column Classroom Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Join Form (6 Columns) */}
          <div className="lg:col-span-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/10 shadow-xl space-y-5"
            >
              <div>
                <h2 className="text-base font-bold text-white font-heading">Enter Classroom Details</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Type the 6-letter join code written on your teacher's board.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-1.5">
                    6-Letter Join Code *
                  </label>
                  <input
                    type="text"
                    autoFocus={!searchParams.get("code")}
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="ABC123"
                    className="w-full rounded-xl border border-white/20 bg-zinc-950 px-4 py-3 font-mono text-center text-2xl font-black tracking-widest text-white placeholder-zinc-700 outline-none focus:border-white focus:ring-1 focus:ring-white/20 uppercase transition-colors"
                    disabled={loading}
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Codes are 6 letters. Ask your teacher for the code, or try the sample class on the home page.
                  </span>
                </div>

                <Input
                  label="Your Nickname *"
                  maxLength={30}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Asha, Leo, Sam"
                  disabled={loading}
                  hint={
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Shield className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      Use a first name or nickname — your full name is never needed.
                    </span>
                  }
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={loading}
                    disabled={!code.trim() || !nickname.trim()}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Enter Classroom & Start
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>

          {/* Right Column: Student Orientation & Expectations (6 Columns) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <HelpCircle className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                  What To Expect in This Quiz
                </h3>
              </div>

              <div className="space-y-4 text-xs text-zinc-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <strong className="text-white block font-medium">Explain Your Thinking</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                      You will be asked to describe your step-by-step reasoning for each problem. Your teacher cares about your thought process, not just the final number.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <strong className="text-white block font-medium">No Penalties for Misconceptions</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                      Mistakes are clues that show where a rule might be misunderstood. Understanding your thinking helps your teacher explain things better.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <strong className="text-white block font-medium">Fair Timing (Riddle 2)</strong>
                    <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                      If you ever run out of time on a question, you can check the "I ran out of time" box so your teacher knows time pressure affected your answer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>Safe • Private • Pedagogical</span>
                <span className="text-zinc-500">v1.3 BehindTheMark</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
