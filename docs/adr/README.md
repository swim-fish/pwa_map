# Architectural Decision Records

This directory holds the project's Architectural Decision Records per
Constitution **Principle V — Documentation & ADRs**.

## Why ADRs

ADRs preserve the _why_ — the piece of context most often lost over
time. Tying ADR updates to the `/speckit.analyze` and `/speckit.implement`
gates ensures the record evolves in lock-step with the code rather than
drifting.

## Index

| #                                                     | Title                                                | Status   | Supersedes |
| ----------------------------------------------------- | ---------------------------------------------------- | -------- | ---------- |
| [0001](0001-ui-framework-svelte.md)                   | UI framework — Svelte 4.x                            | Accepted | —          |
| [0002](0002-map-engine-maplibre.md)                   | Map engine — MapLibre GL JS 3.x                      | Accepted | —          |
| [0003](0003-tile-source-osm-default.md)               | Day-1 tile source — OSM Standard                     | Accepted | —          |
| [0004](0004-coord-libraries-proj4-mgrs-custom.md)     | Coord libs — proj4 + mgrs + hand-rolled Taiwan math  | Accepted | —          |
| [0005](0005-build-tooling-vite.md)                    | Build tooling — Vite 5 + vite-plugin-pwa             | Accepted | —          |
| [0006](0006-testing-vitest-playwright.md)             | Testing — Vitest unit + Playwright E2E               | Accepted | —          |
| [0007](0007-prettier-eslint.md)                       | Formatter + linter — Prettier + ESLint flat config   | Accepted | —          |
| [0008](0008-storage-localstorage.md)                  | Preference storage — localStorage + schema guard     | Accepted | —          |
| [0009](0009-i18n-three-locale-zh-en-ja.md)            | i18n — minimal 3-locale store (zh canonical, en, ja) | Accepted | —          |
| [0010](0010-go-to-parser-dispatch.md)                 | Go-To parser — ordered dispatch over 7 sub-parsers   | Accepted | —          |
| [0011](0011-tm2-zone-auto-resolve.md)                 | TM2 zone ambiguity — back-project + pick per §9      | Accepted | —          |
| [0012](0012-taipower-main-island-only.md)             | Taipower MVP — main-island letters A–X only          | Accepted | —          |
| [0013](0013-performance-verification-pipeline.md)     | Performance verification pipeline                    | Accepted | —          |
| [0014](0014-accessibility-baseline.md)                | Accessibility baseline                               | Accepted | —          |
| [0015](0015-release-readiness-001-coord-map-pwa.md)   | Release readiness — feature `001-coord-map-pwa`      | Accepted | —          |
| [0016](0016-analyze-driven-verification-hardening.md) | Analyze-driven verification hardening                | Accepted | —          |
| [0017](0017-goto-split-layout-architecture.md)        | Go-To split-layout architecture (composer + chips)   | Accepted | —          |
| [0018](0018-recents-storage-schema.md)                | Recents storage schema — `pwa_map:gotoHistory_v1`    | Accepted | —          |
| [0019](0019-flyto-zoom-preservation.md)               | `MapController.flyTo` zoom preservation              | Accepted | —          |
| [0020](0020-map-source-catalogue.md)                  | Map source catalogue + HTTPS upgrade                 | Accepted | —          |
| [0021](0021-prefs-additive-evolution.md)              | `pwa_map:prefs` additive schema evolution            | Accepted | —          |
| [0022](0022-tile-failure-toast.md)                    | Tile-failure detection + auto-revert toast           | Accepted | —          |
| [0023](0023-sw-registration-strategy.md)              | SW registration strategy — `autoUpdate` → `prompt`   | Accepted | —          |
| [0024](0024-dev-manifest-middleware.md)               | Dev-mode manifest middleware                         | Accepted | —          |
| [0025](0025-pwa-install-surfaces.md)                  | PWA install surfaces & dismissal-key design          | Accepted | —          |

## Adding a new ADR

1. Copy an existing ADR as a template to `NNNN-<short-slug>.md`.
2. Fill the sections: Context, Decision, Consequences, Alternatives considered.
3. Append a row to the Index table above.
4. Commit as part of the change that made the decision.

## Amending an ADR

Never rewrite a landed ADR in place. Add a new ADR whose _Supersedes_ column
references the old one and flip the old ADR's Status to `Superseded by NNNN`.
