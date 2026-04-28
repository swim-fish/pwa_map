import { afterEach, vi } from 'vitest';

// jsdom does not implement URL.createObjectURL. MapLibre's module-init
// code (maplibre-gl/dist/maplibre-gl.js) calls it once at import time
// to register a worker URL. Without a stub, any test that imports a
// component which transitively pulls in maplibre-gl (e.g. LocateButton's
// `maplibregl.Marker` reference) fails at load time. We return an
// inert blob: URL — MapLibre's worker is never spun up in jsdom anyway.
if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL !== 'function') {
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:jsdom-noop',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});
