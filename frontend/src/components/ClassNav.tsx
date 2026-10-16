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

export function ClassNav({
  classId,
  className,
  token,
  joinCode,
  activeTab,
  onOpenProjector,
}: ClassNavProps) {
  const [copied, setCopied] = useState(false);
  const hash = token ? `#${token}` : "";

  const tabs = [
    {
      id: "stream",
      label: "Stream",
      icon: <Radio className="w-4 h-4" />,
      href: `/teacher/${classId}${hash}`,
    },
    {
      id: "classwork",
      label: "Classwork",
      icon: <ClipboardList className="w-4 h-4" />,
      href: `/teacher/${classId}/quiz${hash}`,
    },
    {
      id: "results",
      label: "Results & Misconceptions",
      icon: <BarChart3 className="w-4 h-4" />,
      href: `/teacher/${classId}/results${hash}`,
    },
  ];

  async function handleQuickCopyLink() {
    if (!joinCode) return;
    const url = `${window.location.origin}/join?code=${joinCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 z-20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 pb-0">
        {/* Left: Class Identity & Back */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold font-heading text-white truncate max-w-[200px] sm:max-w-xs">
              {className}
            </h1>
          </div>
        </div>

        {/* Center: Google Classroom-Style Tabs (Stream, Classwork, Results) */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-full pb-0.5 sm:pb-0" aria-label="Class Navigation">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={`relative px-3.5 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Join Code Projector Widget */}
        {joinCode && (
          <div className="hidden md:flex items-center gap-2 pb-1.5 sm:pb-0">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-300">
              <span className="font-mono text-[11px] text-zinc-400">Code:</span>
              <span className="font-mono font-bold text-white tracking-wider">{joinCode}</span>
              {onOpenProjector && (
                <button
                  type="button"
                  onClick={onOpenProjector}
                  className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Project Join Code on Big Screen"
                  aria-label="Display code in projector view"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleQuickCopyLink}
              className="p-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title="Copy Student Invite Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5 text-zinc-400" />}
              <span className="hidden lg:inline">{copied ? "Copied" : "Invite"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassNav;
