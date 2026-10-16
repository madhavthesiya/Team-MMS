import { useId, useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyField({ label, value, helpText, large = false }: {
  label: string; value: string; helpText?: string; large?: boolean;
}) {
  const id = useId();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function handleCopy() {
    try { await navigator.clipboard.writeText(value); setState("copied"); }
    catch { setState("failed"); }
  }
  return (
    <div className="ui-field my-4">
      <label htmlFor={id} className="ui-field-label">{label}</label>
      <div className="flex min-w-0 items-stretch gap-2">
        <input id={id} readOnly value={value} onFocus={(event) => event.currentTarget.select()}
          aria-describedby={helpText ? id + "-help" : undefined}
          className={["ui-control flex-1 font-mono", large ? "text-lg font-bold tracking-widest" : "text-sm"].join(" ")} />
        <button type="button" onClick={handleCopy} aria-label={"Copy " + label}
          className="min-h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 text-xs font-semibold text-white hover:bg-zinc-700 cursor-pointer">
          {state === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {state === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      {helpText && <p id={id + "-help"} className="ui-field-hint">{helpText}</p>}
      <p role="status" aria-live="polite" className={state === "failed" ? "ui-field-error" : "ui-field-hint"}>
        {state === "copied" ? "Copied to clipboard." : state === "failed" ? "Copy unavailable. Select the text and copy it manually." : ""}
      </p>
    </div>
  );
}
