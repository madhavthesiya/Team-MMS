import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { storage } from "../lib/storage";
import type { User, UserRole } from "../api/types";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { ErrorBox } from "./ErrorBox";
import { GraduationCap, Users, LogIn, UserPlus, Sparkles } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
  initialRole?: UserRole;
  initialTab?: "login" | "register";
}

export function AuthModal({
  open,
  onClose,
  onSuccess,
  initialRole = "teacher",
  initialTab = "login",
}: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFillDemo(demoRole: UserRole) {
    setError(null);
    setRole(demoRole);
    setTab("login");
    if (demoRole === "teacher") {
      setIdentifier("teacher@school.edu");
      setPassword("Password123!");
    } else {
      setIdentifier("student@school.edu");
      setPassword("Password123!");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "login") {
        if (!identifier.trim()) throw new Error("Please enter your email or username.");
        if (!password) throw new Error("Please enter your password.");

        const res = await api.login({ identifier: identifier.trim(), password });
        storage.setAuthToken(res.token);
        storage.setAuthUser(res.user);
        window.dispatchEvent(new Event("btm_auth_change"));
        onSuccess?.(res.user);
        onClose();
      } else {
        if (!email.trim() || !email.includes("@")) throw new Error("Please enter a valid email address.");
        if (username.trim().length < 3) throw new Error("Username must be at least 3 characters.");
        if (!fullName.trim()) throw new Error("Please enter your full name.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");

        const res = await api.register({
          role,
          email: email.trim(),
          username: username.trim(),
          full_name: fullName.trim(),
          password,
        });
        storage.setAuthToken(res.token);
        storage.setAuthUser(res.user);
        window.dispatchEvent(new Event("btm_auth_change"));
        onSuccess?.(res.user);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white font-mono text-[11px] mb-1">
            <Sparkles size={12} className="text-zinc-300" />
            <span>BehindTheMark Real Account</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-white">
            {tab === "login" ? "Sign In to Your Account" : "Create a Real Account"}
          </h2>
          <p className="text-xs text-zinc-400">
            {tab === "login"
              ? "Access your managed classes, student quizzes, and diagnostic history."
              : "Choose your role to get started with full persistent account features."}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Register) */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-950 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(null); }}
            className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === "login" ? "bg-white text-black font-semibold shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === "register" ? "bg-white text-black font-semibold shadow-sm" : "text-zinc-400 hover:text-white"
            }`}
          >
            <UserPlus size={14} />
            <span>Register</span>
          </button>
        </div>

        {/* Role Selector (When Registering or Choosing Account Type) */}
        {tab === "register" && (
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole("teacher")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  role === "teacher"
                    ? "bg-zinc-900 border-white text-white shadow-md shadow-white/5"
                    : "bg-zinc-950/60 border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className={role === "teacher" ? "text-white" : "text-zinc-500"} />
                  <span className="font-semibold text-xs">Teacher</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Manage classes & diagnostics</p>
              </button>

              <button
                type="button"
                onClick={() => setRole("student")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  role === "student"
                    ? "bg-zinc-900 border-white text-white shadow-md shadow-white/5"
                    : "bg-zinc-950/60 border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users size={16} className={role === "student" ? "text-white" : "text-zinc-500"} />
                  <span className="font-semibold text-xs">Student</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Take quizzes & re-checks</p>
              </button>
            </div>
          </div>
        )}

        {/* Quick Demo Credentials Autofill */}
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Quick Demo Accounts:</span>
            <span className="text-[10px] text-zinc-500">Click to autofill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo("teacher")}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-[11px] font-mono text-left transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap size={13} className="text-zinc-400" />
              <span className="truncate">Teacher: Prof. MMS</span>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo("student")}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-[11px] font-mono text-left transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Users size={13} className="text-zinc-400" />
              <span className="truncate">Student: StudentUser</span>
            </button>
          </div>
        </div>

        {error && <ErrorBox message={error} onRetry={() => setError(null)} />}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === "login" ? (
            <>
              <Input
                label="Email or Username"
                placeholder="teacher@school.edu or teacher_mms"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </>
          ) : (
            <>
              <Input
                label="Full Name"
                placeholder="e.g. Sarah Connor, Alex Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="your.email@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Input
                label="Username"
                placeholder="e.g. sarah_teacher, alex99"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
              <Input
                label="Password (min 6 chars)"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              loading={loading}
              loadingText={tab === "login" ? "Signing In…" : "Creating Account…"}
            >
              {tab === "login" ? "Sign In" : `Create ${role === "teacher" ? "Teacher" : "Student"} Account`}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
