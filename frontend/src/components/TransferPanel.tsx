import { useCallback, useEffect, useState } from "react";
import { Route, CalendarClock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api/client";
import type { RecheckView, ScheduleRechecksOut, TransferQuestionReport, Verdict } from "../api/types";
import { labelText, verdictColor, verdictText } from "../lib/labels";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { ErrorBox } from "./ErrorBox";
import { Spinner } from "./Spinner";

const DELAYS = [
  { days: 0, label: "Now (demo — can't show it lasted)" },
  { days: 1, label: "Tomorrow" },
  { days: 7, label: "In a week" },
  { days: 30, label: "In a month" },
];

function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold ${verdictColor[verdict]}`}>
      {verdictText(verdict)}
    </span>
  );
}

/** One re-check: the changed situation, what the student did, the verdict and what to change. */
export function RecheckRow({ recheck, showNickname = true }: { recheck: RecheckView; showNickname?: boolean }) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const opensAt = new Date(recheck.available_at);
  const waiting = recheck.verdict === "pending" && opensAt.getTime() > now;
  return (
    <div className="rounded-xl bg-black/60 border border-white/10 p-3.5 space-y-2">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex flex-wrap items-center justify-between gap-2 text-left">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {showNickname && <span className="text-sm font-medium text-white">{recheck.nickname}</span>}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
            {recheck.transfer_item.change}
          </span>
          {waiting ? (
            <span className="text-[11px] font-mono text-zinc-400">opens {opensAt.toLocaleDateString()}</span>
          ) : (
            <VerdictPill verdict={recheck.verdict} />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="space-y-2.5 text-xs text-zinc-300 pt-2 border-t border-white/5">
          <p><span className="text-zinc-500">New situation:</span> {recheck.transfer_item.prompt}</p>
          <p><span className="text-zinc-500">Next step offered before it:</span> {recheck.next_step || "—"}</p>
          {recheck.answered_at ? (
            <>
              <p>
                <span className="text-zinc-500">Answer:</span>{" "}
                <span className="font-mono text-white">{recheck.answer}</span>{" "}
                {recheck.is_correct ? "✓" : "✗"} · {recheck.gap_days?.toFixed(1)} days after the first answer · no hints
              </p>
              {recheck.explanation && (
                <blockquote className="border-l-2 border-white/20 pl-3 italic text-zinc-200">"{recheck.explanation}"</blockquote>
              )}
              {recheck.reading_label && (
                <p><span className="text-zinc-500">Reading:</span> {labelText(recheck.reading_label, recheck.misconception_label)}</p>
              )}
              <p className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-zinc-100">
                <strong>What to change:</strong> {recheck.change_plan}
              </p>
            </>
          ) : (
            <p className="text-zinc-400">Not answered yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Riddle 4 — Better marks, better understanding? Per question: schedule an unaided re-check in a changed
 * situation after a delay, then compare better marks with understanding that travelled and lasted.
 */
export function TransferPanel({ classId, token, questionId }: { classId: number; token: string; questionId: number }) {
  const [report, setReport] = useState<TransferQuestionReport | null>(null);
  const [lastingDays, setLastingDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delay, setDelay] = useState(7);
  const [nextStep, setNextStep] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [lastRun, setLastRun] = useState<ScheduleRechecksOut | null>(null);
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState({ prompt: "", correct_answer: "", change: "" });

  // The results page remounts this panel per question, so state starts fresh for each one.
  const load = useCallback(async () => {
    try {
      const data = await api.getTransferReport(classId, token);
      setLastingDays(data.lasting_days);
      setReport(data.questions.find((q) => q.question_id === questionId) ?? null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load re-checks.");
    } finally {
      setLoading(false);
    }
  }, [classId, token, questionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function schedule() {
    setScheduling(true);
    setError(null);
    try {
      setLastRun(await api.scheduleRechecks(classId, token, { question_id: questionId, delay_days: delay, next_step: nextStep.trim() }));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not schedule re-checks.");
    } finally {
      setScheduling(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api.addTransferItem(classId, token, questionId, {
        prompt: item.prompt.trim(), correct_answer: item.correct_answer.trim(), answer_type: "number",
        choices: [], change: item.change.trim(),
      });
      setItem({ prompt: "", correct_answer: "", change: "" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add the situation.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-white/10 text-white"><Route className="w-4 h-4" /></span>
          <div>
            <h3 className="text-sm font-bold font-heading text-white">Did it travel? Better marks vs better understanding</h3>
            <p className="text-xs text-zinc-400">
              A re-check in a new situation, with no hints, after a gap. Learned = right with the key idea, {lastingDays}+ days later.
            </p>
          </div>
        </div>
        {report && report.answered > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">Better marks: {report.better_marks}/{report.answered}</span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">Better understanding: {report.better_understanding}/{report.answered}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-200">Lasted: {report.verdicts.lasting}</span>
          </div>
        )}
      </div>

      {loading && <Spinner text="Loading re-checks…" />}
      {error && <ErrorBox message={error} onRetry={load} />}

      {!loading && report && (
        <>
          {report.transfer_item_count === 0 ? (
            <form onSubmit={addItem} className="space-y-3 p-4 rounded-xl bg-black/40 border border-dashed border-white/15">
              <p className="text-xs text-zinc-300">
                Add the same idea in a changed situation first (new numbers, a story, the reverse question). Students never see the same re-check twice.
              </p>
              <Input label="New situation (question)" value={item.prompt} onChange={(e) => setItem({ ...item, prompt: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Correct answer (number or fraction)" value={item.correct_answer} onChange={(e) => setItem({ ...item, correct_answer: e.target.value })} />
                <Input label="What changed?" placeholder="e.g. word problem" value={item.change} onChange={(e) => setItem({ ...item, change: e.target.value })} />
              </div>
              <Button type="submit" size="sm" loading={adding} disabled={!item.prompt.trim() || !item.correct_answer.trim() || !item.change.trim()} icon={<Plus className="w-3.5 h-3.5" />}>
                Add situation
              </Button>
            </form>
          ) : (
            <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="w-full space-y-1.5">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">Re-check opens</span>
                  <select
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white"
                  >
                    {DELAYS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
                  </select>
                </label>
                <Input label="Next step you're offering (optional)" placeholder="Default: from each student's story" value={nextStep} maxLength={500} onChange={(e) => setNextStep(e.target.value)} />
              </div>
              <Button size="sm" onClick={schedule} loading={scheduling} icon={<CalendarClock className="w-3.5 h-3.5" />}>
                Schedule re-check for everyone who answered
              </Button>
              <p className="text-[11px] text-zinc-500">{report.transfer_item_count} situation{report.transfer_item_count === 1 ? "" : "s"} available for this question.</p>
              {lastRun && (
                <p className="text-xs text-zinc-300">
                  Scheduled {lastRun.scheduled.length}.
                  {lastRun.skipped.length > 0 && ` Skipped: ${lastRun.skipped.map((s) => `${s.nickname} (${s.reason})`).join("; ")}.`}
                </p>
              )}
            </div>
          )}

          {report.rechecks.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">No re-checks yet for this question.</p>
          ) : (
            <div className="space-y-2.5">
              {report.rechecks.map((rc) => <RecheckRow key={rc.recheck_id} recheck={rc} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
