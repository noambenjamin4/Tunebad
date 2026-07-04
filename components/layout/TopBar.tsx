"use client";

import { useState } from "react";
import { NavTabs } from "./NavTabs";
import { useTuner } from "../TunerApp";
import { LanguageMenu } from "@/components/ui/LanguageMenu";

export function TopBar() {
  const { showView } = useTuner();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a
          className="brand"
          href="#analysis"
          aria-label="Tuner home"
          onClick={(event) => {
            event.preventDefault();
            showView("analysis");
            setMenuOpen(false);
          }}
        >
          TUNER
        </a>

        <nav className="top-actions" aria-label="Tuner tools">
          <NavTabs />
        </nav>

        <span className="lang-slot">
          <LanguageMenu variant="desktop" />
        </span>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen ? (
        <div className="mobile-nav" role="menu">
          <NavTabs onNavigate={() => setMenuOpen(false)} />
          <LanguageMenu variant="mobile" />
        </div>
      ) : null}
    </header>
  );
}
