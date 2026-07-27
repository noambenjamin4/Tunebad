// Stub for Node builtins that must never enter a browser bundle.
//
// essentia.js ships an emscripten build whose glue PROBES for fs/path/crypto
// (`if (!nodeFS) nodeFS = require("fs")`) on a branch it never takes in a
// browser. Webpack had `resolve.fallback: { fs: false }` for exactly this,
// which resolves the import to an empty module. Turbopack has no `false`, so
// the empty module has to actually exist.
//
// The failure mode if this breaks is quiet, not loud: the analyzer worker
// throws, falls back to the homemade DSP, and BPM/key answers get worse with
// nothing erroring. Check a known-key file after touching it.
const emptyModule = {};
export default emptyModule;
