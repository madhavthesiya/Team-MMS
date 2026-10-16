import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Copy, Check, Maximize2, Minimize2, ExternalLink, Users } from "lucide-react";

export interface ClassCodeModalProps {
  open: boolean;
  onClose: () => void;
  className: string;
  joinCode: string;
}

export function ClassCodeModal({ open, onClose, className, joinCode }: ClassCodeModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const studentJoinUrl = `${window.location.origin}/join?code=${joinCode}`;

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(studentJoinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Classroom Projector View"
      description={`Displaying join code for ${className}`}
      size="lg"
    >
      <div className="flex flex-col items-center justify-center py-6 px-2 text-center space-y-6">
        {/* Class Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-zinc-300">
          <Users className="w-3.5 h-3.5 text-white" />
          <span className="font-semibold text-white">{className}</span>
          <span>•</span>
          <span className="text-zinc-400">Diagnostic Assessment</span>
        </div>

        {/* Student Instruction Scaffolding */}
        <div className="text-sm text-zinc-400 max-w-sm">
          Tell students to visit <strong className="text-white font-mono">{window.location.host}/join</strong> and enter this code:
        </div>

        {/* Giant Monospace Code Display (Google Classroom Projector Style) */}
        <div className="relative group w-full max-w-md py-8 px-6 rounded-2xl bg-zinc-950 border-2 border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center transition-all hover:border-white/40">
          <div className="font-mono text-5xl sm:text-7xl font-black tracking-[0.25em] text-white pl-[0.25em] select-all cursor-pointer">
            {joinCode}
          </div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mt-4">
            6-Character Classroom Code
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            variant="primary"
            size="md"
            onClick={handleCopyCode}
            leftIcon={copiedCode ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
          >
            {copiedCode ? "Code Copied!" : "Copy Code"}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            leftIcon={copiedLink ? <Check className="w-4 h-4 text-white" /> : <ExternalLink className="w-4 h-4" />}
          >
            {copiedLink ? "Invite Link Copied!" : "Copy Student Link"}
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={toggleFullscreen}
            leftIcon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          >
            {isFullscreen ? "Exit Fullscreen" : "Projector Fullscreen"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ClassCodeModal;
