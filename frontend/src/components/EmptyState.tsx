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
    <div className="my-5 w-full max-w-2xl rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 sm:p-10 text-center mx-auto">
      <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 mb-4">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-white font-heading">{title}</h3>
      {children && <div className="mt-3 text-sm leading-relaxed text-zinc-400 max-w-md mx-auto">{children}</div>}
    </div>
  );
}
