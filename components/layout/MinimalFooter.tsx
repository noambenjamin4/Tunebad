// The compact English-only footer used by the standalone server-rendered SEO
// pages (song/artist/hub pages, /camelot-wheel, /playlist-analyzer, ...).
// Deliberately NOT components/layout/Footer.tsx: that one is the full
// sitemap-style footer (tagline + every tool and guide link) and needs the
// i18n provider; this one is just the brand mark and copyright line.
export function MinimalFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.png" />
            <img src="/logo-light.png" alt="" width={24} height={24} className="site-footer-logo" loading="lazy" />
          </picture>
          <span className="site-footer-wordmark">TUNEBAD</span>
        </div>
        <p className="site-footer-copyright">© 2026 TuneBad</p>
      </div>
    </footer>
  );
}
