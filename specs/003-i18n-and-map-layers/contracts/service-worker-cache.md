# Contract: Service-worker tile cache

**Feature**: `003-i18n-and-map-layers`
**Surface**: `vite.config.ts` `VitePWA({ workbox: { runtimeCaching } })`
**Consumers**: end-user offline experience; verified by E2E.

This contract pins the cache rules for tile origins so US3 (offline
parity) is delivered.

---

## 1. Existing rule (feature 001)

```ts
{
  urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'osm-tiles',
    expiration: { maxEntries: 4096, maxAgeSeconds: 60 * 60 * 24 * 7 },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

OSM is served from `a.tile.openstreetmap.org`, `b.tile...`,
`c.tile...`, all matched by the pattern above.

---

## 2. New rules (feature 003)

Append two new rules:

```ts
{
  urlPattern: /^https:\/\/wmts\.nlsc\.gov\.tw\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'nlsc-tiles',
    expiration: { maxEntries: 4096, maxAgeSeconds: 60 * 60 * 24 * 7 },
    cacheableResponse: { statuses: [0, 200] },
  },
},
{
  urlPattern: /^https:\/\/mt\d?\.google\.com\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'google-tiles',
    expiration: { maxEntries: 4096, maxAgeSeconds: 60 * 60 * 24 * 7 },
    cacheableResponse: { statuses: [0, 200] },
  },
},
```

The Google pattern uses `mt\d?\.google\.com` so `mt1`, `mt2`, etc.
all match — the catalogue uses `mt1` exclusively but the regex is
intentionally permissive so a future `mt2` swap is automatically
covered.

---

## 3. Why attribution stays out of MapLibre's style

The existing `AttributionBar.svelte` (feature 001) is the
project's authoritative attribution surface. MapLibre's built-in
attribution control is suppressed (`attributionControl: false` in
`MapView.svelte`). The catalogue's `attributionKey` drives
`AttributionBar`, which is locale-aware. Routing attribution
through the i18n store keeps Principle V's locale parity invariant.

---

## 4. Test obligations

### Manual verification (no automated test for SW config)

1. `npm run build` produces a `dist/sw.js` whose generated source
   contains the three rules' `cacheName` strings (`osm-tiles`,
   `nlsc-tiles`, `google-tiles`).
2. Manual smoke test: load NLSC tiles online, go offline (DevTools
   throttling → `Offline`), pan within the loaded area — tiles
   render.
3. Quota: switching the basemap five times and panning each map
   over a 4×4-tile area uses < 50 MB of cache total.

### E2E

US3.AS1 / AS2 are covered indirectly by Playwright's
`context.setOffline(true)` in the new E2E spec.
