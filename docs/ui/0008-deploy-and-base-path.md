# UI Record 0008 — GitHub Pages Auto-Deploy + Subpath Base Path

**Status**: Accepted (landed at `/speckit.implement` 2026-04-27)
**Affected screens**: app shell URL — production now serves at
`https://swim-fish.github.io/pwa_map/` (subpath form). The PWA's
own UI is unchanged in pixel terms; what changes is the URL the
user sees in the address bar, the URL the PWA installs to, and the
URL `npm run preview` serves locally.
**Feature**: `specs/008-gh-pages-deploy/`

## Context

Features 001–007 were authored and tested as if the app would be
served at the root path `/`. With this feature the app goes public
via GitHub Pages, which (without a custom domain) publishes the
repo to `https://<owner>.github.io/<repo>/` — i.e., everything has
to live under the project name as a subpath. The `vite.config.ts`,
the PWA manifest's `start_url` / `scope` / `id`, and the
service-worker registration scope all have to agree on that
subpath, otherwise asset URLs 404, the SW registers against the
wrong scope, the install banner installs the wrong URL, and the
update prompt path breaks.

This UI record documents the THREE user-visible URL changes — what
the user sees, what the contributor sees, and what changes about
the installed PWA's behaviour — so a future reader inheriting the
codebase doesn't get confused by the subpath that pervades the
emitted asset URLs and the manifest.

## Design goals

1. **Subpath is automatic, not configurable**. `vite.config.ts`
   uses a function-form `defineConfig` that branches on
   `command`: `'build'` → `base: '/pwa_map/'`,
   `'serve'` → `base: '/'`. Contributors don't have to remember
   any env var or run a special command.
2. **Local dev is preserved**. `npm run dev` continues to serve
   at `http://localhost:5173/` (no subpath). Only `npm run build`
   and `npm run preview` use the subpath form — and `preview`
   serving at `http://localhost:4173/pwa_map/` is the documented
   change so previewing locally matches what GitHub Pages
   publishes.
3. **Manifest paths cannot drift from `base`**. The manifest's
   `start_url`, `scope`, and `id` are constructed inside the
   function body from the same `base` literal. They cannot be set
   to different values by accident.
4. **One-time manual setup, then forever automatic**. A single
   admin-only click in `Settings → Pages` enables the deploy
   pipeline. Every push to `master` thereafter is auto-built and
   auto-published. Documented in
   `specs/008-gh-pages-deploy/quickstart.md`.

## URL changes — three audience views

### What the END USER sees

| Before this feature                | After this feature                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| (nothing — app was never deployed) | `https://swim-fish.github.io/pwa_map/`                                                                  |
| (no installed PWA possible)        | Installing the PWA (feature-005 banner) opens to the same subpath URL on the home screen / app launcher |

### What the CONTRIBUTOR sees

| Command           | Before                   | After                            |
| ----------------- | ------------------------ | -------------------------------- |
| `npm run dev`     | `http://localhost:5173/` | `http://localhost:5173/`         |
| `npm run preview` | `http://localhost:4173/` | `http://localhost:4173/pwa_map/` |
| `npm run build`   | bakes `base="/"`         | bakes `base="/pwa_map/"`         |

The `preview` URL change is the only one that affects daily
contributor workflow. If you're used to copy-pasting
`http://localhost:4173/` into the browser, you need to add
`/pwa_map/` after this feature. The trade-off is that `preview`
now mirrors production exactly — if `preview` works, the deployed
site works.

### What the INSTALLED PWA holds

| Manifest field | Before  | After       |
| -------------- | ------- | ----------- |
| `start_url`    | `/`     | `/pwa_map/` |
| `scope`        | `/`     | `/pwa_map/` |
| `id`           | (unset) | `/pwa_map/` |

For first-time users this is invisible. There IS no prior installed
PWA on the deployed URL (this is the first deploy), so no
migration / orphaning concern applies.

## Layout & tokens

NONE. This feature does NOT change a single pixel of UI, does NOT
add or modify a design token, does NOT touch any Svelte component.
The visual UI inherited from features 001–007 is preserved exactly.

## Interactions

NONE new. Every existing user interaction (pan, zoom, format
toggle, Go-To, Settings sheet, install banner, update prompt)
behaves identically — they just operate against URLs prefixed with
`/pwa_map/` instead of `/` when the build is the production one.

## Accessibility notes

NONE new. Accessibility coverage from features 001–007 (WCAG-AA
contrast, ≥ 36 px tap targets, keyboard navigation, reduced-motion
honour) is unchanged. The subpath does not affect any of those
properties.

## Reduced-motion behaviour

NONE new. The deploy automation does not introduce any animation.
Reduced-motion handling from features 005, 006, 007 is unchanged.

## Verification (load-bearing test)

`tests/integration/deploy-base-alignment.spec.ts` (8 cases) is the
load-bearing safety property: it asserts that after every
`npm run build`, `dist/manifest.webmanifest`'s `start_url` /
`scope` / `id` agree with each other AND with the URL prefix Vite
emits in `dist/index.html`. The spec is **base-agnostic** — it
READS the prefix out of the emitted HTML and asserts internal
consistency, so a future custom-domain migration that flips `base`
back to `/` does NOT break it. Cases (7) and (8) directly assert
the function-form `base === '/'` for `command: 'serve'` and
`base === '/pwa_map/'` for `command: 'build'`.

This spec runs in BOTH `ci.yml` (PR build verification) and
`deploy.yml` (deploy-time build) — drift CANNOT reach production
without failing the gate.

## Screenshots

To be captured manually after the first deploy lands (per `tasks.md`
T010(g)):

- Browser address bar showing `https://swim-fish.github.io/pwa_map/`
- DevTools → Application → Manifest panel showing the three subpath
  fields
- DevTools → Application → Service Workers panel showing scope
  `/pwa_map/`
- Lighthouse PWA audit run against the deployed URL with the
  recorded score (SC-006 part b)

These artefacts will be added to `docs/ui/screenshots/` in a
follow-up commit after the maintainer completes the manual smoke
of T010.

## Open questions

- **Custom domain migration path**. If the project later acquires
  a custom domain (CNAME), `base` needs to flip back to `/`. The
  function-form makes this a one-line change. The PWA `id` change
  WILL orphan installed apps — operators on the subpath form would
  need to re-install. This is a known cost of any future migration
  and would itself warrant a UI-record entry at that time.
- **Lighthouse-against-deployed-URL automation**. Currently a
  manual step (T010g). A future feature could add a Lighthouse CI
  job triggered after `actions/deploy-pages` succeeds, asserting
  the deployed URL meets the same threshold as `lighthouse.yml`'s
  preview gate. Out of scope here.

## Acceptance traceability

- spec FR-010 ("PWA functions correctly under the GitHub Pages
  URL"): satisfied by the manifest + index.html + sw.js base
  alignment, asserted by `deploy-base-alignment.spec.ts`.
- spec FR-011 ("SW update-prompt flow continues to work"):
  satisfied by leaving `src/pwa/registerSW.ts` unchanged (research
  D7) — SW scope auto-derives from the script URL, which equals
  `base` after build. Verified manually in T010(h).
- spec FR-018 / SC-008 ("local dev unchanged / no new local
  commands required"): satisfied by `command === 'serve'` keeping
  `base === '/'`.
- spec SC-006 (Lighthouse PWA ≥ 90 at both measurement points):
  preview-side covered by existing `lighthouse.yml`; deployed-URL
  side covered by manual step T010(g).
- spec SC-007 (install end-to-end on deployed URL): covered by
  manual smoke T010(e + f).
