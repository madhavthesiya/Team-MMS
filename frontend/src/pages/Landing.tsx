import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Fingerprint, FlaskConical, MessageSquare, Route, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import { api } from "../api/client";
import { storage } from "../lib/storage";
import { Button } from "../components/ui/Button";
import { ErrorBox } from "../components/ErrorBox";
import { AuthModal } from "../components/AuthModal";

const workflow = [
  { icon: BookOpen, number: "01", title: "Start with their thinking", text: "Collect an answer, an explanation and a confidence check. Keep the original evidence intact." },
  { icon: Fingerprint, number: "02", title: "Consider more than one story", text: "A mistaken rule, a missed condition or time pressure can lead to the same answer. Look at the evidence before choosing." },
  { icon: MessageSquare, number: "03", title: "Ask one useful question", text: "When the picture is unclear, offer a short, optional check. Your teacher makes the final call." },
  { icon: Route, number: "04", title: "Check that it travelled", text: "Come back later with the same idea in a new situation and no hints. A better mark only counts if the reasoning holds." },
];

export default function Landing() {
  const navigate = useNavigate();
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  async function handleTrySample() {
    setLoadingSample(true);
    setError(null);
    try {
      const created = await api.createSampleClass();
      storage.setTeacherToken(created.class_id, created.teacher_token);
      navigate("/teacher/" + created.class_id + "#" + created.teacher_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create a sample class. Please try again.");
    } finally { setLoadingSample(false); }
  }

  return (
    <div className="landing-page">
      <section className="hero-grid" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> A clearer picture of learning
            <Sparkles size={13} className="text-white/80 animate-pulse ml-1" aria-hidden="true" />
          </p>
          <h1 id="hero-heading">Same score.<br /><span>Different story.</span></h1>
          <p className="hero-description">
            An answer tells you what. A learner’s reasoning helps you understand why.
            Look beyond the mark, explore the evidence, and choose a better next step together.
          </p>
          <div className="hero-actions">
            <Button size="lg" onClick={handleTrySample} loading={loadingSample} loadingText="Setting up your class…"
              icon={<FlaskConical size={18} aria-hidden="true" />} iconRight={<ArrowRight size={18} aria-hidden="true" />}>
              Try the sample class
            </Button>
            <Link to="/teacher/new" className="button-link secondary">Create a class</Link>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="button-link secondary flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck size={16} />
              <span>Sign In / Accounts</span>
            </button>
          </div>
          <div className="hero-note">
            <Check size={15} aria-hidden="true" />
            <span>Real persistent accounts or instant guest access. Zero pre-filled results.</span>
          </div>
          <Link to="/join" className="student-entry">
            Joining your teacher’s class? <span>Enter a join code <ArrowUpRight size={16} aria-hidden="true" /></span>
          </Link>
          {error && <ErrorBox message={error} onRetry={handleTrySample} />}
        </div>

        <aside className="reasoning-card" aria-label="How BehindTheMark approaches an answer">
          <div className="reasoning-card-top">
            <span className="eyebrow">Look beyond the answer</span>
            <span className="reasoning-card-icon"><MessageSquare size={19} aria-hidden="true" /></span>
          </div>
          <div className="reasoning-card-title">A mark is a starting point.<br /><span>Not the whole picture.</span></div>

          {/* Duality Case Contrast */}
          <div className="grid grid-cols-2 gap-2.5 my-4">
            <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">Asha (7/10)</span>
                <span className="text-[10px] text-emerald-300 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/40">Understood</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-1 truncate">"converted 1/2 to 2/4"</p>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-950/90 border border-white/5 hover:border-white/15 transition-all">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-300">Leo (7/10)</span>
                <span className="text-[10px] text-amber-300 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/40">Adds across</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-1 truncate">"1+1 is 2, 2+4 is 6"</p>
            </div>
          </div>

          <div className="reasoning-layers">
            {[
              { label: "The answer", detail: "What did the learner submit?", icon: BookOpen },
              { label: "The reasoning", detail: "How did they get there?", icon: Fingerprint },
              { label: "The next conversation", detail: "What would help us understand?", icon: MessageSquare },
            ].map(({ label, detail, icon: Icon }, index) => (
              <div key={label} className="reasoning-layer">
                <div className="layer-icon"><Icon size={19} aria-hidden="true" /></div>
                <div><strong>{label}</strong><p>{detail}</p></div>
                <span className="layer-number">0{index + 1}</span>
              </div>
            ))}
          </div>
          <div className="reasoning-card-bottom"><ShieldCheck size={16} aria-hidden="true" /> Evidence first. Teacher judgement always.</div>
        </aside>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-heading">
        <div className="section-heading">
          <div><p className="eyebrow">A little more understanding</p><h2 id="workflow-heading">From an answer to a conversation.</h2></div>
          <p>A focused workflow for teachers and learners.<br className="hidden sm:block" /> Not another ranking or verdict.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map(({ icon: Icon, number, title, text }) => (
            <article key={number} className="workflow-card">
              <div className="workflow-card-top"><Icon size={21} aria-hidden="true" /><span>{number}</span></div>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="quick-start" aria-labelledby="start-heading">
        <div className="quick-start-intro">
          <span className="section-icon"><Users size={23} aria-hidden="true" /></span>
          <p className="eyebrow">Two sides of one classroom</p>
          <h2 id="start-heading">Try the complete flow.</h2>
          <p>Open the teacher view here and join as a learner in a second tab or on your phone.</p>
        </div>
        <ol className="quick-start-steps">
          <li><span>1</span><div><h3>Create a sample class</h3><p>Start with a fractions quiz and share the join code. Responses begin empty.</p></div></li>
          <li><span>2</span><div><h3>Answer in your own words</h3><p>Join with a nickname, share your thinking and respond to an optional check.</p></div></li>
          <li><span>3</span><div><h3>Review the evidence</h3><p>Return to the teacher view to compare stories and decide what comes next.</p></div></li>
        </ol>
      </section>
      <div className="privacy-note"><ShieldCheck size={18} aria-hidden="true" />
        <p>Use nicknames and avoid personal details. Explanations may be sent to an AI provider to support your teacher’s review.</p>
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => navigate("/account")}
      />
    </div>
  );
}
