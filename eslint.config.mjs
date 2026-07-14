import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  {
    // The react-hooks v6 "compiler" rules flag this codebase's intentional
    // latest-value-ref and setState-in-effect patterns (audio playback state,
    // rAF loops, mount-time detection). Keep rules-of-hooks and exhaustive-deps
    // active; silence only the new heuristic rules rather than mass-editing
    // working code.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default eslintConfig;
