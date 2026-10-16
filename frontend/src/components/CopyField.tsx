import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyField({
  label,
  value,
  helpText,
  large = false,
}: {
  label: string;
  value: string;
  helpText?: string;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
          {label}
        </label>
        {copied && (
          <span className="text-[11px] text-white flex items-center gap-1 font-medium animate-fadeIn">
            <Check className="w-3.5 h-3.5" /> Copied to clipboard!
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          readOnly
          value={value}
          onClick={handleCopy}
          className={`w-full rounded-xl border border-white/10 bg-zinc-950/80 pl-3.5 pr-24 py-2.5 font-mono text-zinc-100 outline-none transition-all focus:border-white focus:ring-1 focus:ring-white/20 select-all ${
            large ? "text-lg sm:text-xl font-bold tracking-widest text-white" : "text-xs sm:text-sm"
          }`}
        />
        <button
          type="button"
          onClick={handleCopy}
          className={`absolute right-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
            copied
              ? "bg-white text-black font-semibold"
              : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600/60"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {helpText && <p className="mt-1 text-[11px] text-zinc-400">{helpText}</p>}
    </div>
  );
}
