import type { ReactNode } from "react";
import { AlertCircle, Info, CheckCircle2 } from "lucide-react";

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success";
  children: ReactNode;
}) {
  const styles = {
    info: "border-white/15 bg-zinc-900/60 text-zinc-200",
    warn: "border-zinc-500/40 bg-zinc-900/80 text-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.04)]",
    success: "border-white/30 bg-zinc-900/90 text-white shadow-[0_0_15px_rgba(255,255,255,0.06)]",
  }[tone];

  const Icon = {
    info: Info,
    warn: AlertCircle,
    success: CheckCircle2,
  }[tone];

  return (
    <div
      role="status"
      className={`my-3.5 flex items-start gap-3 rounded-xl border p-3.5 text-xs sm:text-sm backdrop-blur-md shadow-sm ${styles}`}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5 opacity-90" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
