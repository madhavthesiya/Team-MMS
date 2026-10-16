import type { Confidence, Label, Source, Status } from "../api/types";

export function labelText(label: Label, misconceptionLabel?: string | null): string {
  switch (label) {
    case "understood":
      return "Understood";
    case "misread":
      return "Missed a condition in the question";
    case "misconception":
      return misconceptionLabel ? `Mistaken rule: ${misconceptionLabel}` : "Mistaken rule";
    case "guessed":
      return "Likely guessed";
    case "slip":
      return "Careless slip";
    case "out_of_time":
      return "Ran out of time";
    case "not_sure":
      return "Several stories — not chosen yet";
  }
}

export const labelColor: Record<Label, { badge: string; border: string; glow: string; text: string }> = {
  understood: {
    badge: "bg-white text-black border-white font-bold",
    border: "border-white/40",
    glow: "shadow-[0_0_15px_rgba(255,255,255,0.22)]",
    text: "text-white",
  },
  misread: {
    badge: "bg-zinc-800 text-zinc-100 border-zinc-500",
    border: "border-zinc-500/40",
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.06)]",
    text: "text-zinc-200",
  },
  misconception: {
    badge: "bg-zinc-900 text-white border-zinc-400 font-medium",
    border: "border-zinc-400/50",
    glow: "shadow-[0_0_12px_rgba(255,255,255,0.12)]",
    text: "text-zinc-100",
  },
  guessed: {
    badge: "bg-zinc-900/90 text-zinc-300 border-zinc-700",
    border: "border-zinc-700/60",
    glow: "shadow-none",
    text: "text-zinc-300",
  },
  slip: {
    badge: "bg-black text-zinc-400 border-zinc-800",
    border: "border-zinc-800",
    glow: "shadow-none",
    text: "text-zinc-400",
  },
  out_of_time: {
    badge: "bg-zinc-900 text-amber-300 border-amber-600/50 font-medium",
    border: "border-amber-600/40",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.1)]",
    text: "text-amber-200",
  },
  not_sure: {
    badge: "bg-zinc-950 text-zinc-400 border-zinc-700 border-dashed",
    border: "border-zinc-700/50",
    glow: "shadow-none",
    text: "text-zinc-400",
  },
};

export function sourceText(source: Source): string {
  switch (source) {
    case "rule":
      return "Rules only";
    case "ai":
      return "AI analysis";
    case "both":
      return "Rules & AI agree";
    case "teacher":
      return "Teacher verified";
  }
}

export function statusText(status: Status): string {
  switch (status) {
    case "open":
      return "Waiting for follow-up";
    case "settled":
      return "Settled";
    case "not_sure":
      return "Review recommended";
  }
}

export function confidenceText(conf: Confidence): string {
  switch (conf) {
    case "sure":
      return "Confident";
    case "unsure":
      return "Unsure";
    case "guessed":
      return "Guessed";
  }
}
