import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="my-6 rounded-2xl border border-dashed border-white/15 bg-zinc-950/50 p-8 sm:p-12 text-center backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/10 text-zinc-300 mb-4">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-white font-heading">{title}</h3>
      {children && <div className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">{children}</div>}
    </div>
  );
}
