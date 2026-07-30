import Link from "next/link";
import { MinimalFooter } from "@/components/layout/MinimalFooter";

// Branded 404. This page carries real traffic: ~163k programmatic song/hub
// URLs mean stale links and guessed slugs land here constantly, and fourteen
// notFound() call sites route through it. Until this file existed they all
// got Next's unbranded default — no logo, no navigation, a dead end.
//
// Server component, English-only by design: the standalone SEO pages render
// English at the server too, and a 404 must never depend on client JS to be
// useful.
export default function NotFound() {
  return (
    <div className="app-shell">
      <header className="legal-topbar">
        <Link href="/" className="brand" aria-label="TuneBad, back to home">
          <span className="brand-logo-wrap">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark-76.webp" />
              <img src="/logo-light-76.webp" alt="" width={34} height={34} className="brand-logo" />
            </picture>
          </span>
          <span className="brand-wordmark">TUNEBAD</span>
        </Link>
      </header>

      <main id="main-content">
        <article className="legal">
          <h1 className="legal-title">Page not found</h1>
          <p>
            This page doesn&apos;t exist — the song may not be in the catalog yet, or the link is
            stale. Everything below does exist:
          </p>
          <ul>
            <li>
              <Link href="/key-bpm-finder">Find the key and BPM of any song</Link>
            </li>
            <li>
              <Link href="/daw">Mix songs on one timeline in the DAW</Link>
            </li>
            <li>
              <Link href="/songs">Browse the song key &amp; BPM database</Link>
            </li>
            <li>
              <Link href="/tools">All free tools</Link>
            </li>
          </ul>
          <p className="legal-back">
            <Link href="/">← Back to TuneBad</Link>
          </p>
        </article>
      </main>

      <MinimalFooter />
    </div>
  );
}
