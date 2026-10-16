import { Link } from "react-router-dom";
import { ArrowLeft, Radio, ClipboardList, BarChart3, Maximize2, Share2, Check } from "lucide-react";
import { useState } from "react";

export interface ClassNavProps {
  classId: number | string;
  className: string;
  token?: string;
  joinCode?: string;
  activeTab: "stream" | "classwork" | "results";
  onOpenProjector?: () => void;
}

export function ClassNav({ classId, className, token, joinCode, activeTab, onOpenProjector }: ClassNavProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const hash = token ? "#" + token : "";
  const tabs = [
    { id: "stream", label: "Overview", icon: Radio, href: "/teacher/" + classId + hash },
    { id: "classwork", label: "Questions", icon: ClipboardList, href: "/teacher/" + classId + "/quiz" + hash },
    { id: "results", label: "Results", icon: BarChart3, href: "/teacher/" + classId + "/results" + hash },
  ];
  async function handleQuickCopyLink() {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + "/join?code=" + joinCode);
      setCopyStatus("copied");
    } catch { setCopyStatus("failed"); }
  }
  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950 px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 py-2">
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <Link to="/" aria-label="Back to overview" className="inline-flex min-h-11 min-w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white">
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <h1 className="truncate text-sm font-semibold text-white" title={className}>{className}</h1>
        </div>
        {joinCode && (
          <div className="flex items-center gap-1">
            {onOpenProjector && <button type="button" onClick={onOpenProjector} aria-label="Display code in projector view"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
              <span className="font-mono font-semibold tracking-wider">{joinCode}</span>
              <Maximize2 size={14} aria-hidden="true" />
            </button>}
            <button type="button" onClick={handleQuickCopyLink} aria-label="Copy student invite link"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer">
              {copyStatus === "copied" ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
            </button>
          </div>
        )}
        <nav className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto" aria-label="Class navigation">
          {tabs.map(({ id, label, icon: Icon, href }) => (
            <Link key={id} to={href} aria-current={activeTab === id ? "page" : undefined}
              className={["flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors sm:flex-none",
                activeTab === id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"].join(" ")}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      {copyStatus !== "idle" && <p role="status" className="pb-2 text-xs text-zinc-300">
        {copyStatus === "copied" ? "Student invite link copied." : "Could not access the clipboard. Use the class link below to copy manually."}
      </p>}
    </div>
  );
}
export default ClassNav;
