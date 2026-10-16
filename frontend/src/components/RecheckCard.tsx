import { useState } from "react";
import { Send, CalendarCheck } from "lucide-react";
import { api } from "../api/client";
import type { Confidence, StudentRecheck } from "../api/types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { ErrorBox } from "./ErrorBox";

const CONFIDENCE: { value: Confidence; label: string }[] = [
  { value: "sure", label: "Sure" },
  { value: "unsure", label: "Not sure" },
  { value: "guessed", label: "I guessed" },
];

/**
 * Riddle 4: a later check-in in a changed situation, answered without the tool's help —
 * no follow-up question, no hints, and no result shown afterwards.
 */
export function RecheckCard({
  recheck,
  token,
  nickname,
  onDone,
}: {
  recheck: StudentRecheck;
  token: string;
  nickname: string;
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [confidence, setConfidence] = useState<Confidence | "">("");
  const [startedAt] = useState(() => Date.now()); // the parent keys this card by recheck_id, so it resets per check-in
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !confidence) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.answerRecheck(token, recheck.recheck_id, {
        answer: answer.trim(),
        explanation: explanation.trim(),
        self_confidence: confidence,
        time_spent_seconds: Math.round((Date.now() - startedAt) / 1000),
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full flex-1 min-h-0 overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-6">
      <form onSubmit={submit} className="max-w-xl w-full glass-panel rounded-2xl p-5 sm:p-7 border border-white/10 space-y-5">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-white/10 text-white shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Check-in</p>
            <h1 className="text-lg font-bold font-heading text-white">Welcome back, {nickname}</h1>
            <p className="text-xs text-zinc-400 mt-1">
              One question, on your own this time: no hints and no extra questions. Show how you would work it out.
            </p>
          </div>
        </div>

        <p className="text-base sm:text-lg text-white font-medium leading-relaxed">{recheck.prompt}</p>

        {recheck.answer_type === "choice" ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Your answer">
            {recheck.choices.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={answer === c}
                onClick={() => setAnswer(c)}
                className={`px-4 py-2 rounded-xl border text-sm transition-all ${
                  answer === c ? "bg-white text-black border-white font-bold" : "bg-zinc-900 border-zinc-700 text-zinc-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <Input label="Your answer" value={answer} maxLength={100} onChange={(e) => setAnswer(e.target.value)} />
        )}

        <Textarea
          label="How did you work it out?"
          value={explanation}
          maxLength={2000}
          rows={4}
          placeholder="Explain in your own words."
          onChange={(e) => setExplanation(e.target.value)}
        />

        <div className="space-y-2">
          <p className="text-xs text-zinc-400">How sure are you?</p>
          <div className="grid grid-cols-3 gap-2">
            {CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setConfidence(c.value)}
                className={`px-3 py-2 rounded-xl border text-xs sm:text-sm transition-all ${
                  confidence === c.value ? "bg-white text-black border-white font-bold" : "bg-zinc-900 border-zinc-700 text-zinc-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          loadingText="Sending…"
          disabled={submitting || !answer.trim() || !confidence}
          icon={<Send className="w-4 h-4" />}
        >
          Send answer
        </Button>
      </form>
    </div>
  );
}
