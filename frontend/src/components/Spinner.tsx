import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function Spinner({
  text = "Loading…",
  subtext,
  variant = "default",
}: {
  text?: string;
  subtext?: string;
  variant?: "default" | "ai";
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="relative flex items-center justify-center mb-4">
        {variant === "ai" ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
              className="w-14 h-14 rounded-full border-2 border-white/10 border-t-white border-r-white/50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
          </>
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-zinc-800 border-t-white animate-spin" />
        )}
      </div>

      <p className="text-sm font-medium text-white">{text}</p>
      {subtext && <p className="text-xs text-zinc-400 mt-1 max-w-sm">{subtext}</p>}
    </div>
  );
}
