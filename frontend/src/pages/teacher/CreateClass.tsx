import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { storage } from "../../lib/storage";
import { ErrorBox } from "../../components/ErrorBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { GraduationCap, ArrowLeft, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CreateClass() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <GraduationCap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">Create a New Class</h1>
              <p className="text-xs text-zinc-400">Set up a space for your students and diagnostic quizzes.</p>
            </div>
          </div>

          {error && (
            <div className="mb-5">
              <ErrorBox message={error} onRetry={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Class Name"
              autoFocus
              maxLength={80}
              placeholder="e.g. 7B Mathematics, Grade 9 Science"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              hint="Give your class a recognizable name for students."
            />

            <div className="flex justify-end -mt-3">
              <span className="text-[11px] font-mono text-zinc-500">{name.length}/80</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              disabled={!name.trim()}
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              Create Class & Generate Code
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
