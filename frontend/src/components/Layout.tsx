import { Link, NavLink, useLocation } from "react-router-dom";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUpRight, GraduationCap, Menu, RotateCw, UserCheck, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api/client";
import { storage } from "../lib/storage";
import type { User } from "../api/types";
import { Brand } from "./Brand";
import SwarmCursor from "./SwarmCursor";
import { AuthModal } from "./AuthModal";

const navigation = [
  { to: "/", label: "Overview" },
  { to: "/teacher/new", label: "Create a class" },
  { to: "/join", label: "Join a class" },
  { to: "/account", label: "Account" },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(() => storage.authUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
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
    const syncAuth = () => setAuthUser(storage.authUser());
    window.addEventListener("btm_auth_change", syncAuth);
    return () => window.removeEventListener("btm_auth_change", syncAuth);
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
    } catch { setHealth("offline"); }
  }

  return (
    <div className="app-shell relative">
      {/* Precision ambient lighting & subtle micro-dot grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-white/[0.03] rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -right-[10%] w-[500px] h-[500px] bg-zinc-800/[0.1] rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      </div>

      {/* Interactive GPU Swarm Cursor Overlay */}
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <SwarmCursor
          count={260}
          size={2.0}
          shape="dot"
          color="#f4f4f5"
          accentColor="#a1a1aa"
          spread={65}
          speed={0.9}
          swirl={0.5}
          tail={0.4}
          trail={0.6}
          wander={0.3}
          depth={0.6}
          clickEffect="burst"
          targets="a, button, [role='button'], input, select, textarea, [data-swarm-target]"
          hideCursor={false}
          className="h-full w-full pointer-events-none"
        />
      </div>

      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }}>Skip to content</a>
      <header className="app-header relative z-40">
        <div className="app-header-inner">
          <Link to="/" className="brand-link" aria-label="BehindTheMark home" onClick={() => setOpenPath(null)}>
            <Brand />
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end className={({ isActive }) => ["nav-link", isActive ? "is-active" : ""].join(" ")}>
                {item.label}
                {item.to === "/join" && <ArrowUpRight size={14} aria-hidden="true" />}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            {authUser ? (
              <Link
                to="/account"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-xs font-mono text-white transition-all shadow-sm"
                title={`Logged in as ${authUser.full_name} (${authUser.role})`}
              >
                {authUser.role === "teacher" ? (
                  <GraduationCap size={13} className="text-zinc-300" />
                ) : (
                  <Users size={13} className="text-zinc-300" />
                )}
                <span className="font-semibold max-w-[100px] truncate">{authUser.full_name.split(" ")[0]}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400 capitalize hidden sm:inline">
                  {authUser.role}
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-xs text-white transition-all cursor-pointer font-medium"
              >
                <UserCheck size={13} className="text-zinc-400" />
                <span>Account</span>
              </button>
            )}

            <div className="connection-status" role="status" aria-label="Service connection">
              <span className={["status-dot", health].join(" ")} aria-hidden="true" />
              <span>{health === "online" ? "Service online" : health === "offline" ? "Connection issue" : "Connecting"}</span>
              {health === "offline" && (
                <button type="button" onClick={retryHealth} className="status-retry" aria-label="Retry service connection">
                  <RotateCw size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              ref={menuButton}
              type="button"
              className="mobile-menu-button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setOpenPath(menuOpen ? null : location.pathname)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end onClick={() => setOpenPath(null)}
                className={({ isActive }) => ["nav-link", isActive ? "is-active" : ""].join(" ")}>
                {item.label}<ArrowUpRight size={16} aria-hidden="true" />
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className={isLanding ? "app-main landing-scroll relative z-10" : "app-main relative z-10"}>
        <div className={isLanding ? "landing-container" : ["app-workspace", isEntry ? "is-entry" : ""].join(" ")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className={isLanding ? "w-full" : "h-full flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden"}
            >
              {children}
            </motion.div>
          </AnimatePresence>
          {isLanding && (
            <footer className="landing-footer">
              <span>BehindTheMark</span>
              <span>Same score. Different story.</span>
              <span>Built around evidence. Guided by teachers.</span>
            </footer>
          )}
        </div>
      </main>
      {!isLanding && (
        <footer className="workspace-footer relative z-20">
          <span>Beyond the score.</span>
          <span>Teacher-led understanding</span>
        </footer>
      )}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthUser(storage.authUser())}
      />
    </div>
  );
}

