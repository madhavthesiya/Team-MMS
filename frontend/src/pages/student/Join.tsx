import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { storage } from "../../lib/storage";
import { ErrorBox } from "../../components/ErrorBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Users, ArrowRight, ArrowLeft, Shield } from "lucide-react";
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
    <div className="h-full flex-1 min-h-0 w-full overflow-y-auto px-4 py-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Home</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl relative"
        >
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">Join Your Class</h1>
              <p className="text-xs text-zinc-400">Enter your code and chosen nickname to begin.</p>
            </div>
          </div>

          {error && (
            <div className="mb-5">
              <ErrorBox message={error} onRetry={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono mb-1.5">
                6-Letter Join Code
              </label>
              <input
                type="text"
                autoFocus={!searchParams.get("code")}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="e.g. K7PQ2M"
                className="w-full rounded-xl border border-white/20 bg-zinc-950 px-4 py-3 font-mono text-center text-xl font-bold tracking-widest text-white placeholder-zinc-700 outline-none focus:border-white focus:ring-1 focus:ring-white/20 uppercase transition-colors"
                disabled={loading}
              />
            </div>

            <Input
              label="Your Nickname"
              maxLength={30}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Asha, Leo, Alex"
              disabled={loading}
              hint={
                <span className="flex items-center gap-1 text-zinc-400">
                  <Shield className="w-3 h-3 text-zinc-500" />
                  Use a nickname — do not use your real full name.
                </span>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-3"
              loading={loading}
              disabled={!code.trim() || !nickname.trim()}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Enter Classroom
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
