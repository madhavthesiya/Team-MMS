import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  charCount?: { current: number; max?: number };
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, charCount, className = "", id,
     "aria-describedby": describedBy, "aria-invalid": invalid, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || "textarea-" + generatedId;
    const description = [describedBy, error ? inputId + "-error" : hint ? inputId + "-hint" : null,
      charCount ? inputId + "-count" : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="ui-field">
        {(label || charCount) && (
          <div className="flex items-start justify-between gap-3">
            {label && <label htmlFor={inputId} className="ui-field-label">{label}</label>}
            {charCount && <span id={inputId + "-count"} className="text-xs text-zinc-400 tabular-nums shrink-0">
              {charCount.current}{charCount.max !== undefined ? " / " + charCount.max : ""} characters
            </span>}
          </div>
        )}
        <textarea ref={ref} id={inputId} aria-describedby={description} aria-invalid={error ? true : invalid}
          className={["ui-control resize-y", className].filter(Boolean).join(" ")} {...props} />
        {error && <p id={inputId + "-error"} role="alert" className="ui-field-error">{error}</p>}
        {hint && !error && <p id={inputId + "-hint"} className="ui-field-hint">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
export default Textarea;
