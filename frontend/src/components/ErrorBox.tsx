import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 rounded-xl border border-white/20 bg-zinc-950/80 p-4 sm:p-5 text-zinc-200 backdrop-blur-md shadow-lg shadow-black/50"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-white/10 text-white shrink-0 border border-white/15">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white font-heading">Something went wrong</h4>
          <p className="mt-1 text-sm text-zinc-300 leading-relaxed">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3.5 inline-flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-200 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-black transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
