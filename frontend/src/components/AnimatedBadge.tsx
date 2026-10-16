import type { Label } from "../api/types";
import { labelColor, labelText } from "../lib/labels";
import { motion } from "framer-motion";

export function AnimatedBadge({
  label,
  misconceptionLabel,
  certainty,
  size = "md",
  showCertainty = false,
}: {
  label: Label;
  misconceptionLabel?: string | null;
  certainty?: number;
  size?: "sm" | "md" | "lg";
  showCertainty?: boolean;
}) {
  const config = labelColor[label] || labelColor.not_sure;
  const text = labelText(label, misconceptionLabel);

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5 font-medium",
    lg: "text-sm px-3.5 py-1.5 gap-2 font-semibold",
  }[size];

  return (
    <motion.span
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center rounded-lg border backdrop-blur-md tracking-tight ${config.badge} ${config.border} ${config.glow} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{text}</span>
      {showCertainty && certainty !== undefined && (
        <span className="opacity-80 text-[10px] font-mono ml-0.5 px-1.5 py-0.5 rounded border border-current/25">
          {Math.round(certainty * 100)}%
        </span>
      )}
    </motion.span>
  );
}
