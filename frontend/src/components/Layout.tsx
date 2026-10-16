import { Link, NavLink, useLocation } from "react-router-dom";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, RotateCw, X } from "lucide-react";
import { api } from "../api/client";
import { Brand } from "./Brand";

const navigation = [
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
    } catch { setHealth("offline"); }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }}>Skip to content</a>
      <header className="app-header">
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

      <main id="main-content" tabIndex={-1} className={isLanding ? "app-main landing-scroll" : "app-main"}>
        <div className={isLanding ? "landing-container" : ["app-workspace", isEntry ? "is-entry" : ""].join(" ")}>
          {children}
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
        <footer className="workspace-footer">
          <span>Beyond the score.</span>
          <span>Teacher-led understanding</span>
        </footer>
      )}
    </div>
  );
}
