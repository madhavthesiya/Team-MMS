import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  charCount?: { current: number; max?: number };
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, charCount, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {(label || charCount) && (
          <div className="flex items-center justify-between">
            {label && (
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono"
              >
                {label}
              </label>
            )}
            {charCount && (
              <span className="text-[11px] font-mono text-zinc-400">
                {charCount.current}
                {charCount.max ? `/${charCount.max}` : ""}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={[
            "w-full rounded-xl border bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 transition-all outline-none resize-y",
            "border-white/10 focus:border-white focus:ring-1 focus:ring-white/20",
            error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
        {hint && !error && <p className="text-[11px] text-zinc-400">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
