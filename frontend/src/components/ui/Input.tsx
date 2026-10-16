import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, rightElement, className = "", id,
     "aria-describedby": describedBy, "aria-invalid": invalid, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || "input-" + generatedId;
    const hintId = inputId + "-hint";
    const errorId = inputId + "-error";
    const description = [describedBy, error ? errorId : hint ? hintId : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="ui-field">
        {label && <label htmlFor={inputId} className="ui-field-label">{label}</label>}
        <div className="relative flex items-center">
          {icon && <div className="absolute left-3.5 text-zinc-400 pointer-events-none flex items-center" aria-hidden="true">{icon}</div>}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={description}
            aria-invalid={error ? true : invalid}
            className={["ui-control", icon ? "pl-11" : "", rightElement ? "pr-12" : "", className].filter(Boolean).join(" ")}
            {...props}
          />
          {rightElement && <div className="absolute right-3 text-zinc-400 flex items-center">{rightElement}</div>}
        </div>
        {error && <p id={errorId} role="alert" className="ui-field-error">{error}</p>}
        {hint && !error && <p id={hintId} className="ui-field-hint">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
