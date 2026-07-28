import bundleAnalyzer from "@next/bundle-analyzer";

const isDev = process.env.NODE_ENV !== "production";

// Static-compatible CSP: the app's pages are prerendered at build time, so a
// per-request nonce (middleware) can never match the baked HTML — that setup
// blocks every script on Vercel. 'unsafe-inline' is required for Next's inline
// bootstrap on static pages. The app DOES have dangerouslySetInnerHTML sinks —
// the ~21 JSON-LD <script> blocks — which is precisely why every one of them
// serializes through jsonLdString (lib/seo/jsonld.ts), escaping < > & so
// third-party text (song titles come from platform oEmbed responses) cannot
// close the script element. An earlier version of this comment claimed no such
// sinks existed; that claim was false and briefly a stored-XSS hole.
// 'unsafe-eval' is REQUIRED in production: essentia.js's emscripten WASM glue
// (the analyzer's BPM/key engine, run in a Web Worker) calls `new Function(...)`,
// which 'wasm-unsafe-eval' does NOT permit. Without it the worker throws an
// EvalError, silently falls back to the far weaker homemade DSP, and BPM/key go
// wrong. Verified via a minimal in-worker repro. The relaxation is acceptable
// here: the app already needs 'unsafe-inline' and has no HTML-injection sinks
// (no dangerouslySetInnerHTML; React-escaped rendering throughout).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: import.meta.dirname,
  // Force the OG-card font into that route's serverless bundle. Webpack rewrites
  // new URL(...import.meta.url) to a bare asset path that fetch() can't parse, so
  // the route reads the font from disk instead — which requires it to be traced.
  outputFileTracingIncludes: {
    "/song/[slug]/opengraph-image": ["./app/_og/Display-Bold.ttf"],
    // The page function evaluates the og-image module too (for its metadata
    // exports), so the font must ship in the page's bundle as well.
    "/song/[slug]": ["./app/_og/Display-Bold.ttf"],
  },
  serverExternalPackages: ["ffmpeg-static"],
  // Next 16 builds with Turbopack. This replaces the old webpack block, whose
  // only job was stubbing Node builtins for essentia.js's emscripten glue —
  // Turbopack spells that as a browser-conditional alias to a real module
  // rather than webpack's `false`.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/empty-module.js" },
      path: { browser: "./lib/empty-module.js" },
      crypto: { browser: "./lib/empty-module.js" },
    },
  },
  async headers() {
    // Stable public assets: cache forever, rename on change. Repeat visitors
    // and tab switches load zero bytes for these.
    const immutable = { key: "Cache-Control", value: "public, max-age=31536000, immutable" };
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          // Vercel injects HSTS for custom domains anyway; asserted here so
          // the policy is ours and survives a host change.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/logo-:variant.png", headers: [immutable] },
      { source: "/logo-:variant-76.webp", headers: [immutable] },
      { source: "/icon-512-maskable.png", headers: [immutable] },
      { source: "/icon-:size.png", headers: [immutable] },
      { source: "/icon.svg", headers: [immutable] },
      { source: "/apple-touch-icon.png", headers: [immutable] },
      { source: "/lame.min.js", headers: [immutable] },
      { source: "/og/:name", headers: [immutable] },
      // ffmpeg.wasm core: 31MB served same-origin (CSP blocks CDNs); immutable
      // so repeat visits to the video tools never re-download it.
      { source: "/vendor/:path*", headers: [immutable] },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withBundleAnalyzer(nextConfig);
