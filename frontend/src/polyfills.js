// Provide Node-like global for libraries expecting it in browser bundles.
if (typeof globalThis.global === "undefined") {
  globalThis.global = globalThis;
}
