import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-black font-semibold hover:bg-zinc-200 border border-white shadow-sm",
  secondary:
    "bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-white font-medium active:scale-[0.98]",
  outline:
    "border border-white/20 bg-transparent hover:bg-white/5 text-zinc-200 hover:text-white font-medium active:scale-[0.98]",
  ghost:
    "bg-transparent hover:bg-white/10 text-zinc-400 hover:text-white font-medium active:scale-[0.98]",
  destructive:
    "bg-red-950/80 border border-red-800/80 hover:bg-red-900 text-red-200 hover:text-white font-medium active:scale-[0.98]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 py-2 text-xs rounded-lg gap-1.5",
  md: "min-h-11 px-4 py-2.5 text-sm rounded-lg gap-2",
  lg: "min-h-12 px-5 py-3 text-sm rounded-xl gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      icon,
      iconRight,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center font-sans leading-snug transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white";

    const resolvedLeftIcon = icon || leftIcon;
    const resolvedRightIcon = iconRight || rightIcon;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={[base, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ")}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {resolvedLeftIcon && <span className="shrink-0">{resolvedLeftIcon}</span>}
            {children}
            {resolvedRightIcon && <span className="shrink-0">{resolvedRightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
