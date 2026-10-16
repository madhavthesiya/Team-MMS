import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string = string> {
  id: T; label: string; count?: number; icon?: ReactNode; badge?: ReactNode;
}
export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]; activeTab: T; onChange: (id: T) => void; className?: string; variant?: "pills" | "underline";
}
export function Tabs<T extends string = string>({ tabs, activeTab, onChange, className = "", variant = "pills" }: TabsProps<T>) {
  const id = useId();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[target].id);
    buttons.current[tabs[target].id]?.focus();
  }
  return (
    <div role="tablist" aria-label="Views" className={[
      "flex max-w-full items-center gap-1 overflow-x-auto",
      variant === "underline" ? "border-b border-white/15" : "rounded-xl border border-white/10 bg-zinc-950 p-1",
      className,
    ].join(" ")}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        return <button key={tab.id} id={id + "-" + tab.id} ref={(el) => { buttons.current[tab.id] = el; }}
          type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1}
          onClick={() => onChange(tab.id)} onKeyDown={(event) => move(event, index)}
          className={["flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium cursor-pointer",
            selected ? "bg-zinc-200 text-zinc-950" : "text-zinc-400 hover:bg-white/5 hover:text-white",
          ].join(" ")}>
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && <span className={["rounded-md px-1.5 py-0.5 text-xs tabular-nums",
            selected ? "bg-black/10" : "bg-white/10"].join(" ")}>{tab.count}</span>}
          {tab.badge}
        </button>;
      })}
    </div>
  );
}
export default Tabs;
