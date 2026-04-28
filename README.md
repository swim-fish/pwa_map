# Taiwan Coordinate Map (PWA)

A Progressive Web App that displays a Taiwan-covering base map with a
crosshair reticle locked to the viewport center. The crosshair's
location is rendered live in six coordinate formats — **WGS84 DD**,
**WGS84 DMS**, **TWD97 TM2**, **TWD67 TM2**, **MGRS**, and
**Taipower** — and a **Go To** control pans the map to any entered
coordinate. All conversion math runs client-side; after the first load
the app works offline.

**Live demo**: <https://swim-fish.github.io/pwa_map/>

## Quickstart

```bash
npm install
npm run dev            # http://localhost:5173
```

Run tests:

```bash
npm test               # vitest — unit + integration (~764 tests across features 001–012)
npm run test:e2e       # playwright — story / mobile / install / Go-To narrow viewport (~280 cases across chromium/firefox/webkit profiles)
```

Production build + verification:

```bash
npm run build
npm run bundle-size    # asserts initial JS ≤ 200 KB, CSS ≤ 20 KB gzipped
```

### Local build test (preview the production bundle)

Two preview modes serve `dist/` locally. Choose by URL path you want
to hit:

```bash
npm run preview          # http://localhost:4173/pwa_map/  (deploy-equivalent)
npm run preview:local    # http://localhost:4173/          (root path)
```

- `npm run preview` serves the build produced by `npm run build`
  unchanged. The bundle's asset hrefs and the PWA manifest's
  `start_url` / `scope` / `id` are baked with the GitHub Pages
  subpath `/pwa_map/`, so you **must** open the URL with the
  `/pwa_map/` suffix. This is the deploy-equivalent preview — if it
  works here, it will work on `https://swim-fish.github.io/pwa_map/`.
- `npm run preview:local` rebuilds with `--mode local-preview`. The
  emitted `dist/` uses `base=/`, so the bundle and manifest both
  resolve at the root URL `http://localhost:4173/`. Use this when:
  - you want a clean root URL for ad-hoc browser testing,
  - a tool expects to serve the bundle from `/`, or
  - a previously registered service worker scoped to `/` is
    intercepting requests on the same port.

Caveats for `preview:local`:

- The resulting `dist/` is **not deployable**. The manifest will
  carry `start_url: "/"`, which GitHub Pages would reject. Always
  run `npm run build` (no flag) before `npm run deploy:check`,
  before opening a PR, or before pushing to a branch that triggers
  the Pages deploy workflow.
- If you switch between `/pwa_map/` and `/` previews on the same
  port, the browser's previously registered service worker can
  intercept fetches with the wrong scope (e.g. a stale SW
  registered at `/` returns the old shell at the new URL). Open
  DevTools → Application → Service Workers → **Unregister** and
  Application → Storage → **Clear site data** before reloading.

Review loop (required before any task is considered "done" —
Constitution Principle I + Development Workflow):

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build && npm run bundle-size
```

Full detail lives in [`specs/001-coord-map-pwa/quickstart.md`](specs/001-coord-map-pwa/quickstart.md).

## Features

- **Live readout** — center crosshair + six coordinate formats updating
  at ≥ 10 Hz during pan.
- **Multi-format toggle** — show/hide any of the six formats; choice
  persists across reloads (localStorage).
- **Go To** — parses any supported format; rejects malformed /
  out-of-range / out-of-coverage / unsupported-precision input with a
  localised, category-tagged message.
- **Zone auto-resolution** — TWD97 TM2 pairs without an explicit zone
  are back-projected against both zones and the §9 boundary rule picks
  one; the chosen zone is surfaced as a toast.
- **Copy to clipboard** — one-tap copy of any visible format with a
  textarea fallback when the Clipboard API is denied.
- **Offline** — service-worker-cached shell; tiles best-effort cached.

## Governance & constitution

This project is governed by the constitution at
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) —
TDD is non-negotiable (Principle II), `npm run format` after every
edit (Principle I), `docs/ui/` updated for visible UI changes
(Principle III), performance budgets enforced (Principle IV), and
ADRs logged after each `/speckit.analyze` and `/speckit.implement`
(Principle V).

Note Constitution v1.1.0 Locale conventions: **`zh` is the canonical
locale identifier for Traditional Chinese as written in Taiwan**
(正體中文). `zh-TW`, `zh-Hant`, `zh-CN`, `zh-Hans` are forbidden in
this codebase.

## Feature records

- Active feature: [`specs/011-safe-area-install-buttons/plan.md`](specs/011-safe-area-install-buttons/plan.md)
- Task list: [`specs/011-safe-area-install-buttons/tasks.md`](specs/011-safe-area-install-buttons/tasks.md)
- Design records: [`docs/ui/`](docs/ui/) (0001 → 0011)
- Decisions: [`docs/adr/`](docs/adr/) (0001 → 0031)
- All shipped features: [`specs/`](specs/) (001 coord-map-pwa →
  002 goto-split-input → 003 i18n-and-map-layers →
  004 offline-pwa-polish → 005 pwa-installable → 006 compass →
  007 tile-cache-settings → 008 gh-pages-deploy →
  009 mobile-ui-fixes → 010 mobile-collapsed-readout →
  011 safe-area-install-buttons)
- **PWA mobile / desktop pitfalls + patterns**:
  [`docs/pwa-mobile-desktop-lessons.md`](docs/pwa-mobile-desktop-lessons.md) —
  consolidated lessons across features 005 / 009 / 010 / 011 with
  fix patterns. Path-scoped checkpoints auto-load via
  [`.claude/rules/`](.claude/rules/) when editing the matching
  source files.

## Project structure

```text
src/
  app/                PWA entry + shell + design tokens (tokens.css)
  components/         Svelte components — readout, toolbar, GoTo, settings, install affordances
  coord/              Pure coordinate math (the only module that imports proj4/mgrs) + segments helper
  map/                MapLibre controller + tile source catalogue + bearing signal
  i18n/               Svelte store + zh/en/ja JSON catalogues
  storage/            localStorage read/write + schema guard (prefs v3 + last-view + install-dismissed)
  pwa/                Service-worker registration + install signal + cache policy + derived install surface
  types/              Branded types + Result / Rejection

tests/
  unit/               Per-converter / per-component / per-store specs (~600 tests)
  unit/coord/         Per-converter specs driven by test-vectors.json
  unit/fixtures/      Pinned test-vectors.json + SHA-256 digest
  unit/pwa/           install signal + platform detection
  unit/storage/       prefs schema + offline-ready signal
  integration/        DOM-level cross-component specs (~100 tests)
  e2e/                Playwright story + mobile + install specs

docs/
  adr/                Architectural Decision Records (0001 → 0031)
  ui/                 UI design records (0001 → 0011)
```

## Licences & attribution

- **Source code**: MIT License — see [`LICENSE`](./LICENSE) for the
  full text. Copyright © 2026 Shihyu.
- **Third-party dependencies**: catalogued in
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) — runtime
  deps are MIT / BSD-3-Clause; dev deps are MIT / Apache-2.0 /
  0BSD. All compatible with this project's MIT licence.
- **Test vectors** in `tests/unit/fixtures/test-vectors.json` are
  copied verbatim from the reference document
  `Taiwan Coordinate Systems Reference v2.0.0 (MIT)` — Copyright ©
  2026 TacMap TW contributors. The copy is checked in with its
  SHA-256 digest pinned in `tests/unit/fixtures/vectors-digest.txt`.
- **Map tile data** is fetched from upstream tile servers at
  runtime; the project does NOT redistribute tile data. Each
  source has its own licence; attribution is displayed in the
  in-app `AttributionBar` component:
  - **OpenStreetMap** — ODbL 1.0
  - **NLSC (內政部國土測繪中心)** — 政府資料開放授權條款 1.0
  - **Google Maps** — Google Maps Platform Terms of Service

  The Settings sheet (feature 007) carries a permanent licence
  notice reminding users that the local tile cache is a short-term
  offline performance fallback only — bulk download / redistribution
  is forbidden by these upstream licences.

## Contributing

Use Spec Kit slash commands for non-trivial changes:

- `/speckit.specify` — write or update the feature spec
- `/speckit.plan` — generate the plan + research + data model + contracts
- `/speckit.tasks` — break the plan into a dependency-ordered task list
- `/speckit.implement` — execute the task list (TDD-driven)
- `/speckit.analyze` — cross-artefact consistency check before release

Every change must pass the review loop above before it is considered
complete.
