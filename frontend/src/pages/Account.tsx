import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { storage } from "../lib/storage";
import type { UserProfile } from "../api/types";
import { AuthModal } from "../components/AuthModal";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/Spinner";
import { ErrorBox } from "../components/ErrorBox";
import {
  GraduationCap,
  Users,
  LogOut,
  PlusCircle,
  ArrowRight,
  Copy,
  Check,
  Mail,
  Shield,
  LogIn,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function loadProfile() {
    const token = storage.authToken();
    if (!token) {
      setLoading(false);
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.getMe(token);
      setProfile(data);
      storage.setAuthUser(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load account profile.");
      storage.clearAuth();
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();

    const handleAuthChange = () => loadProfile();
    window.addEventListener("btm_auth_change", handleAuthChange);
    return () => window.removeEventListener("btm_auth_change", handleAuthChange);
  }, []);

  function handleSignOut() {
    storage.clearAuth();
    setProfile(null);
    window.dispatchEvent(new Event("btm_auth_change"));
    navigate("/");
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <Spinner text="Loading account workspace…" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full flex-1 min-h-0 w-full overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 flex flex-col justify-between">
        <div className="max-w-2xl mx-auto w-full space-y-6 text-center my-auto">
          <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-xl shadow-white/10">
            <Shield className="w-8 h-8 text-black" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
              BehindTheMark Account Workspace
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Sign in with your Teacher or Student account to manage persistent classrooms, track student diagnostics, and view learning history.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setAuthModalOpen(true)}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign In / Register
            </Button>
            <Link to="/" className="button-link secondary">
              Back to Home
            </Link>
          </div>
        </div>

        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => loadProfile()}
        />
      </div>
    );
  }

  const { user, classes, enrollments } = profile;
  const isTeacher = user.role === "teacher";

  return (
    <div className="h-full flex-1 min-h-0 w-full overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 flex flex-col justify-between space-y-6">
      <div className="w-full space-y-6">
        {/* Account Header Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-7 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-60" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg shadow-white/10 shrink-0">
                {isTeacher ? (
                  <GraduationCap className="w-7 h-7 text-black" />
                ) : (
                  <Users className="w-7 h-7 text-black" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-black uppercase tracking-wider">
                    {user.role} Account
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-xs text-zinc-400 font-mono">@{user.username}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-white">
                  {user.full_name}
                </h1>
                <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-zinc-500" />
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                leftIcon={<LogOut className="w-3.5 h-3.5 text-zinc-400" />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {error && <ErrorBox message={error} onRetry={loadProfile} />}

        {/* Teacher View: Managed Classes */}
        {isTeacher ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-base font-bold text-white font-heading">
                  Your Managed Classrooms ({classes.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Classes linked to your teacher profile. Enter any cockpit to review student thinking.
                </p>
              </div>
              <Link
                to="/teacher/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-zinc-200"
              >
                <PlusCircle size={15} />
                <span>Create New Class</span>
              </Link>
            </div>

            {classes.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-3 border border-white/10">
                <GraduationCap className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="text-sm font-semibold text-white">No classes created yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Start by creating your first diagnostic space or generate a sample quiz.
                </p>
                <Link
                  to="/teacher/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs mt-2"
                >
                  Create Class
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((cls) => (
                  <motion.div
                    key={cls.class_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4 shadow-xl"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-400">
                          Class #{cls.class_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cls.join_code)}
                          className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                          title="Copy join code"
                        >
                          {copiedCode === cls.join_code ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} className="text-zinc-400" />
                          )}
                          <span>Code: {cls.join_code}</span>
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-white font-heading truncate">
                        {cls.name}
                      </h3>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-400 pt-1">
                        <div className="p-2 rounded-lg bg-zinc-950/80 border border-white/5">
                          <span className="text-[10px] text-zinc-500 block">Students</span>
                          <span className="text-sm font-bold text-white">{cls.student_count}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-zinc-950/80 border border-white/5">
                          <span className="text-[10px] text-zinc-500 block">Questions</span>
                          <span className="text-sm font-bold text-white">{cls.question_count}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                      <Link
                        to={`/teacher/${cls.class_id}`}
                        className="flex-1 text-center py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Cockpit</span>
                        <ArrowRight size={13} />
                      </Link>
                      <Link
                        to={`/teacher/${cls.class_id}/results`}
                        className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs border border-white/10 transition-colors"
                      >
                        Results
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Student View: Enrolled Classes */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-base font-bold text-white font-heading">
                  Your Enrolled Classes ({enrollments.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Diagnostic quiz sessions and re-checks linked to your student account.
                </p>
              </div>
              <Link
                to="/join"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-zinc-200"
              >
                <Users size={15} />
                <span>Join Another Class</span>
              </Link>
            </div>

            {enrollments.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-3 border border-white/10">
                <Users className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="text-sm font-semibold text-white">No classes joined yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Type your teacher’s 6-letter join code to enroll in a quiz.
                </p>
                <Link
                  to="/join"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs mt-2"
                >
                  Join Class
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrollments.map((enr) => (
                  <motion.div
                    key={enr.student_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4 shadow-xl"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-400">
                          Enrolled as: {enr.nickname}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {enr.answered_count} / {enr.total_questions} answered
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white font-heading truncate">
                        {enr.class_name}
                      </h3>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="h-full bg-white transition-all duration-500"
                            style={{
                              width: `${
                                enr.total_questions > 0
                                  ? (enr.answered_count / enr.total_questions) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <Link
                        to="/student"
                        className="w-full text-center py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Open Quiz Session</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => loadProfile()}
      />
    </div>
  );
}
