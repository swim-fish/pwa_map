# ADR 0024 — Dev-mode manifest middleware

**Status**: Accepted
**Date**: 2026-04-26
**Feature**: `specs/004-offline-pwa-polish/`

## Context

Running the project with `vite dev` produces a console error:

```
manifest.webmanifest:1 Manifest: Line: 1, column: 1, Syntax error.
```

The cause: `vite-plugin-pwa`'s `devOptions.enabled` is intentionally
`false` (the production SW must NOT register in dev because tests + HMR
rely on no SW being installed). With the plugin disabled, requests to
`/manifest.webmanifest` fall through to Vite's SPA fallback, which
returns `index.html`. The browser then tries to parse that HTML as JSON
and reports a syntax error at column 1.

This is harmless in dev (no SW) but it (a) trains contributors to
ignore manifest errors, (b) prevents Chromium's installability heuristic
from succeeding in dev, and (c) violates Constitution Principle V's
"no errors in normal operation" expectation.

## Decision

Add a single-purpose Vite plugin `devManifestPlugin(manifest)` in
`src/pwa/devManifestPlugin.ts` and register it alongside
`VitePWA(...)` in `vite.config.ts`. The plugin sets `apply: 'serve'`
so it never runs during `vite build`. Its `configureServer(server)`
hook registers a middleware on `/manifest.webmanifest` that, for `GET`
requests, responds with:

- `Content-Type: application/manifest+json`
- `Cache-Control: no-cache`
- Body: `JSON.stringify(manifest)` of the same `manifest` object passed
  to `VitePWA({ manifest })`.

Non-`GET` methods and unrelated paths fall through via `next()`.

The `manifest` object is hoisted to a top-level
`const manifest = { ... } as const` in `vite.config.ts` so both
`VitePWA({ manifest })` and `devManifestPlugin(manifest)` consume the
same reference — no duplication, no drift.

## Consequences

- `vite dev` console is clean (zero
  `manifest.webmanifest.*Syntax error` entries).
- Chromium's installability heuristic now succeeds in dev, so
  contributors can verify the install flow without building.
- Production behaviour is unchanged: `vite-plugin-pwa` continues to
  write `dist/manifest.webmanifest` from the same `manifest` object.
- The dev SW stays disabled — only the manifest endpoint becomes valid.
  Tests, HMR, and dev tooling that rely on no SW being installed during
  development are unaffected (FR-020).

## Alternatives considered

- **`devOptions: { enabled: true, type: 'module' }`** — registers a
  real SW in dev. Breaks Vitest test runs (the SW caches the test
  runner HTML), and Playwright's `setOffline()` behaves differently
  when a real SW is installed. Rejected.
- **Static `public/manifest.webmanifest` fixture** — works, but
  duplicates the manifest JSON in two places. Rejected for drift risk.
- **Dismiss the warning as harmless** — fails SC-006 + FR-017 which
  require zero matching console entries.
