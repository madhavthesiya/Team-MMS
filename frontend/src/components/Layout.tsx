import { Link, NavLink, useLocation } from "react-router-dom";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, RotateCw, Sparkles, X } from "lucide-react";
import { api } from "../api/client";
import { Brand } from "./Brand";
import CardNav, { type CardNavItem } from "./CardNav";
import SwarmCursor from "./SwarmCursor";

const navItems: CardNavItem[] = [
  {
    label: "Teacher Cockpit",
    description: "Launch diagnostic assessments, view AI traces & conduct desk interventions.",
    links: [
      { label: "Create a class", href: "/teacher/new" },
      { label: "Sample Class", href: "/teacher/1" },
    ],
  },
  {
    label: "Student Portal",
    description: "Submit answers with self-explanations and optional follow-up checks.",
    links: [
      { label: "Join a class", href: "/join" },
      { label: "Demo Quiz", href: "/join?code=KMJ6WL" },
    ],
  },
  {
    label: "Methodology",
    description: "Same score, completely different cognitive story.",
    links: [
      { label: "Overview", href: "/" },
      { label: "Riddles 1-4 Guide", href: "/" },
    ],
  },
];

const mobileNavigation = [
  { to: "/", label: "Overview" },
  { to: "/teacher/new", label: "Create a class" },
  { to: "/join", label: "Join a class" },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuOpen = openPath === location.pathname;
  const isLanding = location.pathname === "/";
  const isEntry = location.pathname === "/join" || location.pathname === "/teacher/new";

  useEffect(() => {
    let active = true;
    api.checkHealth()
      .then((data) => { if (active) setHealth(data.status === "ok" ? "online" : "offline"); })
      .catch(() => { if (active) setHealth("offline"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  async function retryHealth() {
    setHealth("checking");
    try {
      const data = await api.checkHealth();
      setHealth(data.status === "ok" ? "online" : "offline");
    } catch {
      setHealth("offline");
    }
  }

  return (
    <div className="app-shell relative h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-black text-zinc-100 overflow-hidden font-sans">
      {/* Precision monochrome ambient lighting & subtle micro-dot grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-white/[0.035] rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -right-[10%] w-[500px] h-[500px] bg-zinc-800/[0.12] rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      </div>

      {/* Interactive GPU Swarm Cursor Overlay */}
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <SwarmCursor
          count={320}
          size={2.2}
          shape="dot"
          color="#f4f4f5"
          accentColor="#a1a1aa"
          spread={70}
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

      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>

      {/* Main Navigation Header */}
      <header className="app-header shrink-0 relative z-40 bg-zinc-950/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-2">
        <div className="app-header-inner w-full max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Desktop 3D CardNav */}
          <div className="hidden md:flex flex-1 min-w-0">
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

          {/* Mobile Brand Link */}
          <div className="md:hidden flex items-center">
            <Link to="/" className="brand-link" aria-label="BehindTheMark home" onClick={() => setOpenPath(null)}>
              <Brand />
            </Link>
          </div>

          {/* Status Tool Badge & Mobile Menu Trigger */}
          <div className="header-tools flex items-center gap-3">
            <div className="connection-status flex items-center gap-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-white/10 shadow-sm" role="status" aria-label="Service connection">
              <span className={`status-dot w-2 h-2 rounded-full ${health === "online" ? "online bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" : health === "offline" ? "offline bg-amber-400" : "bg-zinc-500"}`} aria-hidden="true" />
              <span>{health === "online" ? "Service online" : health === "offline" ? "Connection issue" : "Connecting"}</span>
              {health === "offline" && (
                <button type="button" onClick={retryHealth} className="status-retry hover:text-white" aria-label="Retry service connection">
                  <RotateCw size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              ref={menuButton}
              type="button"
              className="mobile-menu-button md:hidden inline-flex items-center justify-center p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setOpenPath(menuOpen ? null : location.pathname)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
          <nav id="mobile-navigation" className="mobile-nav md:hidden border-t border-white/10 pt-3 pb-2 px-2 flex flex-col gap-1" aria-label="Primary navigation">
            {mobileNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                onClick={() => setOpenPath(null)}
                className={({ isActive }) => ["nav-link flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium", isActive ? "is-active bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"].join(" ")}
              >
                <span>{item.label}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main Workspace with Silk-Smooth Route Transition */}
      <main id="main-content" tabIndex={-1} className={isLanding ? "app-main landing-scroll relative z-10 flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 flex flex-col" : "app-main relative z-10 flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col"}>
        <div className={isLanding ? "landing-container w-full max-w-[1600px] mx-auto flex-1 flex flex-col" : ["app-workspace h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden", isEntry ? "is-entry" : ""].join(" ")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={isLanding ? "w-full flex-1 flex flex-col" : "h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden"}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          {isLanding && (
            <footer className="landing-footer border-t border-white/[0.08] bg-black/90 py-6 mt-12 w-full max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-300 font-heading">BehindTheMark</span>
                <span>—</span>
                <span>Same score. Different story.</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <span>Built around evidence</span>
                <span>•</span>
                <span>Guided by teachers</span>
              </div>
            </footer>
          )}
        </div>
      </main>

      {!isLanding && (
        <footer className="workspace-footer shrink-0 h-8 border-t border-white/[0.08] bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono z-20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>BehindTheMark Cockpit</span>
            </span>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <span className="hidden sm:inline text-zinc-400">Riddles 1-4 Active</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>Beyond the score</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">Teacher-led understanding</span>
          </div>
        </footer>
      )}
    </div>
  );
}
