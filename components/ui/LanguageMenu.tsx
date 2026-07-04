"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, useI18n, type LocaleCode } from "@/lib/i18n";

export function LanguageMenu({ variant }: { variant: "desktop" | "mobile" }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((option) => option.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (variant !== "desktop" || !open) return;
    const onDocClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [variant, open]);

  const selectLocale = (code: LocaleCode) => {
    setLocale(code);
    setOpen(false);
  };

  if (variant === "mobile") {
    return (
      <div className="lang-menu-inline" role="listbox" aria-label="Language">
        {LOCALES.map((option) => (
          <button
            key={option.code}
            type="button"
            role="option"
            aria-selected={option.code === locale}
            className={`lang-menu-item${option.code === locale ? " selected" : ""}`}
            onClick={() => selectLocale(option.code)}
          >
            {option.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="lang-menu" ref={wrapRef}>
      <button
        type="button"
        className="lang-menu-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {current.code.toUpperCase()}
        <svg
          className={`lang-menu-chevron${open ? " open" : ""}`}
          width="8"
          height="8"
          viewBox="0 0 10 8"
          aria-hidden="true"
        >
          <polyline points="1,2 5,6 9,2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open ? (
        <div className="lang-menu-panel" role="listbox">
          {LOCALES.map((option) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={option.code === locale}
              className={`lang-menu-item${option.code === locale ? " selected" : ""}`}
              onClick={() => selectLocale(option.code)}
            >
              {option.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
