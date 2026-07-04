declare module "essentia.js/dist/essentia.js-core.es.js" {
  const Essentia: new (wasmModule: unknown, isDebug?: boolean) => unknown;
  export default Essentia;
}

declare module "essentia.js/dist/essentia-wasm.es.js" {
  export const EssentiaWASM: unknown;
}
