import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
  size?: "sm" | "md" | "lg" | "xl";
}
const SIZE_MAP = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl", xl: "max-w-3xl" };

export function Modal({ open, onClose, title, description, children, maxWidth, size = "md" }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const id = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const previousInert = root?.inert ?? false;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'
      )].filter((el) => el.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialog.current.focus(); return; }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || active === dialog.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = previousInert;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <motion.div ref={dialog} role="dialog" aria-modal="true" tabIndex={-1}
          aria-labelledby={title ? id + "-title" : undefined}
          aria-label={title ? undefined : "Dialog"}
          aria-describedby={description ? id + "-description" : undefined}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16 }}
          className={["relative w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 sm:p-7 shadow-2xl space-y-5 outline-none", maxWidth || SIZE_MAP[size]].join(" ")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <h2 id={id + "-title"} className="text-xl font-semibold text-white">{title}</h2>}
              {description && <p id={id + "-description"} className="text-sm leading-relaxed text-zinc-400 mt-2">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close dialog"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div>{children}</div>
        </motion.div>
      </div>}
    </AnimatePresence>, document.body
  );
}
export default Modal;
