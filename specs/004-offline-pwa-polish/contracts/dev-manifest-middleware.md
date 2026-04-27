# Contract: Dev-Mode Manifest Middleware

**Feature**: `004-offline-pwa-polish`

A single-purpose Vite plugin that fixes the
`manifest.webmanifest:1 Syntax error` console entry in dev. Active
only during `vite dev`; production builds are untouched.

---

## 1. Plugin signature

```ts
function devManifestPlugin(manifest: object): Plugin;
```

Returns a Vite plugin object with `apply: 'serve'` so it never runs
during `vite build`.

## 2. Behaviour

- Active only when Vite is in `serve` mode (i.e., the dev server).
- Intercepts requests where the URL pathname equals `/manifest.webmanifest`
  and the method is `GET`.
- Responds with:
  - `Content-Type: application/manifest+json`
  - `Cache-Control: no-cache` (so a manifest tweak during dev hits
    the next reload).
  - Body: `JSON.stringify(manifest)` of the **same** object passed
    to `VitePWA({ manifest })`.
- For any other method (e.g., HEAD) or any other path, calls
  `next()` so the request flows through Vite's normal pipeline.

## 3. Source of truth

The manifest object is hoisted to a top-level `const manifest = { ... } as const`
in `vite.config.ts`. Both `VitePWA({ manifest })` and
`devManifestPlugin(manifest)` consume the same reference. **No
duplication is permitted** (D10).

## 4. Production build path (unchanged)

- `vite build` does NOT activate this plugin (apply: 'serve' guard).
- `vite-plugin-pwa` writes its own `dist/manifest.webmanifest` from
  the same `manifest` object, exactly as today.
- Static hosting / preview serves the built manifest.

## 5. Service-worker behaviour in dev (unchanged)

- `devOptions.enabled` STAYS at `false`.
- No SW registers in dev.
- `src/pwa/registerSW.ts` continues to short-circuit on
  `import.meta.env.DEV`.
- This satisfies FR-020 (fix the manifest endpoint without enabling
  the SW in dev).

## 6. Tests required (TDD-first)

### 6.1 Unit — plugin shape

`tests/unit/build/devManifestPlugin.spec.ts`:

1. The function returns a plugin object with `apply === 'serve'`
   and a `name` starting with `pwa-map:`.
2. Calling the plugin's `configureServer` with a fake server
   registers a middleware on `/manifest.webmanifest`.
3. The middleware writes `Content-Type:
   application/manifest+json` to a fake response.
4. The middleware body parses as JSON and contains the keys passed
   in the manifest argument (`name`, `short_name`, `icons`,
   `start_url`, `display`).
5. A `POST /manifest.webmanifest` (or any non-GET method) calls
   `next()` and does NOT write a response body.
6. A `GET /something-else` calls `next()` and does NOT write a
   response body.

### 6.2 E2E — console hygiene

`tests/e2e/story-4-offline-and-update.spec.ts` includes a check
under "manifest hygiene":

1. Open `http://localhost:5173/`. Capture all console messages.
   Assert zero entries match the regex
   `/manifest\.webmanifest.*Syntax error/i`.
2. Fetch `http://localhost:5173/manifest.webmanifest` directly with
   `page.request.get(...)`. Assert response status `200`,
   `content-type` includes `application/manifest+json`, and the
   parsed JSON has `name === 'Taiwan Coordinate Map'`.

### 6.3 Production-build smoke

`tests/e2e/story-4-offline-and-update.spec.ts` (manifest hygiene,
prod path):

1. Run against `vite preview` (port 4173 by convention) — fetch
   `/manifest.webmanifest` and assert the same shape as 6.2.2.
2. Console should also be clean (no syntax errors).

> The CI matrix runs the dev path on the standard Playwright job; the
> prod path is added as a second job that builds + previews before
> running the spec. Both reuse the same Playwright spec via a
> `BASE_URL` environment variable.

## 7. Failure modes the tests MUST catch

| Bug                                                       | Caught by      |
| --------------------------------------------------------- | -------------- |
| Plugin runs in `vite build` and overrides Workbox output  | 6.1.1          |
| Middleware returns HTML (the SPA fallback) instead of JSON | 6.1.4 + 6.2.1 |
| Wrong content-type breaks Chromium installability         | 6.1.3 + 6.2.2  |
| Plugin intercepts unrelated paths                         | 6.1.6          |
| Manifest object diverges from `VitePWA({ manifest })`     | 6.2.2 + 6.3.1  |
