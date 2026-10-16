import { type ReactNode } from "react";
import { motion } from "framer-motion";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  variant?: "pills" | "underline";
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "pills",
}: TabsProps<T>) {
  if (variant === "underline") {
    return (
      <div className={`flex items-center gap-6 border-b border-white/10 ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative pb-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 outline-none ${
                isActive ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    isActive ? "bg-white text-black" : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge}
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/80 border border-white/10 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2 outline-none ${
              isActive ? "text-black font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-black/15 text-black font-bold" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
