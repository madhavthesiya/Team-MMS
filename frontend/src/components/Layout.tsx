import { Link, useLocation } from "react-router-dom";
import { type ReactNode, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SwarmCursor from "./SwarmCursor";
import CardNav, { type CardNavItem } from "./CardNav";
import { api } from "../api/client";

const navItems: CardNavItem[] = [
  {
    label: "Diagnostics",
    description: "Analyze student reasoning beyond multiple-choice scores.",
    links: [
      { label: "Sample Class (Grade 7)", href: "/teacher/1" },
      { label: "Create New Class", href: "/teacher/new" },
      { label: "Diagnostic Analytics", href: "/teacher/1/results" },
    ],
  },
  {
    label: "Student Portal",
    description: "Submit answers with self-explanations & confidence.",
    links: [
      { label: "Enter Join Code", href: "/join" },
      { label: "Try Demo Quiz (Riddle 1)", href: "/join?code=KMJ6WL" },
    ],
  },
  {
    label: "Methodology",
    description: "Same score, completely different cognitive story.",
    links: [
      { label: "Riddle 1: Same Number", href: "/" },
      { label: "Asha vs. Leo Case Study", href: "/" },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .checkHealth()
      .then((d) => setHealthy(d?.status === "ok"))
      .catch(() => setHealthy(false));
  }, []);

  const isLanding = location.pathname === "/";

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-black text-zinc-100 overflow-hidden font-sans select-none-cursor">
      {/* Precision monochrome ambient lighting & subtle micro-dot grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-white/[0.035] rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -right-[10%] w-[500px] h-[500px] bg-zinc-800/[0.12] rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      </div>

      {/* Interactive WebGL GPU Swarm Cursor Overlay */}
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <SwarmCursor
          count={350}
          size={2.2}
          shape="dot"
          color="#f4f4f5"
          accentColor="#a1a1aa"
          spread={75}
          speed={1.0}
          swirl={0.55}
          tail={0.45}
          trail={0.65}
          wander={0.35}
          depth={0.65}
          clickEffect="burst"
          targets="a, button, [role='button'], input, select, textarea, [data-swarm-target]"
          hideCursor={false}
          className="h-full w-full pointer-events-none"
        />
      </div>

      {/* Google Classroom Full-Width Navigation Header */}
      <header className="shrink-0 z-40 px-4 sm:px-6 lg:px-8 py-2 w-full border-b border-white/[0.08] bg-black/90 backdrop-blur-md">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardNav
              linkComponent={Link}
              theme="dark"
              surface="glass"
              openOn="hover"
              cardEffect="rise"
              cardHeight={210}
              logo={
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-black shadow-sm shadow-white/10">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-extrabold tracking-tight text-base font-heading text-white">
                    BehindTheMark
                  </span>
                </div>
              }
              logoHref="/"
              cta={{
                label: "Student Join",
                href: "/join",
              }}
              items={navItems}
              maxWidth={1800}
            />
          </div>

          {/* Minimalist API Status Badge */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-zinc-400 font-mono bg-zinc-950/80 backdrop-blur-md border border-white/[0.08] px-3.5 py-2 rounded-2xl h-[46px] shadow-lg shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                healthy === true
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse"
                  : healthy === false
                  ? "bg-zinc-600"
                  : "bg-zinc-400"
              }`}
            />
            <span className="hidden xl:inline">
              {healthy === true ? "API Online" : healthy === false ? "Offline" : "Checking…"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace - Adaptive Viewport Layout */}
      {isLanding ? (
        <div className="relative z-10 flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 flex flex-col">
          <main className="w-full max-w-[1600px] mx-auto flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Landing Footer */}
          <footer className="border-t border-white/[0.08] bg-black/90 py-6 mt-12 w-full max-w-[1600px] mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-300 font-heading">BehindTheMark</span>
                <span>—</span>
                <span>Uncovering student misconceptions beyond the score</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <span>Riddle 1: "The Same Number"</span>
                <span>•</span>
                <span className="text-zinc-600">Track B Frontend</span>
              </div>
            </div>
          </footer>
        </div>
      ) : (
        <div className="relative z-10 flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <main className="flex-1 min-h-0 min-w-0 w-full overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Compact Studio Status Bar */}
          <footer className="shrink-0 h-8 border-t border-white/[0.08] bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono z-20">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>BehindTheMark Cockpit</span>
              </span>
              <span className="text-zinc-700 hidden sm:inline">|</span>
              <span className="hidden sm:inline text-zinc-400">Riddle 1: The Same Number</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <span>{healthy ? "System Operational" : "Connecting..."}</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-400">AI Guardrails Active</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
