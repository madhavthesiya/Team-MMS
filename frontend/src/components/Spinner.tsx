export function Spinner({ text = "Loading…", subtext, variant = "default" }: {
  text?: string; subtext?: string; variant?: "default" | "ai";
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-10 px-5 text-center">
      <div aria-hidden="true" className={["mb-5 rounded-full border-2 border-zinc-700 border-t-zinc-100 animate-spin",
        variant === "ai" ? "w-11 h-11" : "w-9 h-9"].join(" ")} />
      <p className="text-sm font-medium text-white">{text}</p>
      {subtext && <p className="text-sm leading-relaxed text-zinc-400 mt-2 max-w-sm">{subtext}</p>}
    </div>
  );
}
