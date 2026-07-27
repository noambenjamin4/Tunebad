// Side-effect imports of stylesheets.
//
// TypeScript 5 accepted `import "./globals.css"` silently; TypeScript 7 wants
// a declaration for it (TS2882). Next's own next-env.d.ts does not cover the
// side-effect form, so it is declared here rather than in that file, which
// Next regenerates.
declare module "*.css";
