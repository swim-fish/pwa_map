# Implementation Plan: Offline-First PWA + Update Prompt + UI Polish

**Branch**: `004-offline-pwa-polish` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-offline-pwa-polish/spec.md`

## Summary

Four discrete polish fixes that turn the PWA shell from "browser-tab-with-tiles" into a true offline-first installable app, without changing any product behaviour from features 001–003:

1. **Offline-first verification** (US1, P1 / MVP) — the existing
   `vite-plugin-pwa` + Workbox runtime already precaches the app shell
   and stale-while-revalidates tile origins (OSM / NLSC / Google) since
   feature 003. This story does not add caching; it surfaces the
   capability with a one-time "available offline" toast on first SW
   activation, hardens the registration so it cannot silently fail,
   and adds explicit E2E coverage for the `network-offline + reload`
   flow that no test currently asserts.

2. **Controlled-update flow** (US2, P2) — flip `registerType` from
   `'autoUpdate'` to `'prompt'`, wire the resulting `onNeedRefresh`
   callback into a small Svelte writable, and render a non-blocking
   `UpdatePrompt.svelte` toast in `App.svelte` with **Update now** and
   **Later** actions. "Later" stores `postponedUntil = now + 30 min`
   in memory; the prompt re-fires on next session because the SW is
   still in `waiting` state.

3. **Attribution contrast fix** (US3, P2) — `.attribution` in
   `AttributionBar.svelte` currently uses
   `background: rgba(255,255,255,0.82)` + `color: var(--color-fg)`,
   which collapses in dark mode (light text on light background).
   Replace with an opaque dual-token pair (`--attribution-bg` /
   `--attribution-fg`) defined in `src/app/tokens.css` for both
   `:root` and the `prefers-color-scheme: dark` block, with computed
   contrast ≥ 4.5:1 in both. No DOM, layout, or position change.

4. **Dev-mode manifest hygiene** (US4, P3) — `manifest.webmanifest:1
   Syntax error` in dev is the SPA fallback returning HTML for that
   URL because `devOptions.enabled: false`. Fix by registering a tiny
   Vite middleware in `vite.config.ts` that serves the in-config
   `manifest` object as JSON for `/manifest.webmanifest` during `vite
   dev`. Production preview is unaffected (Workbox writes the manifest
   to `dist/`). The dev SW stays disabled — only the manifest endpoint
   becomes valid in dev.

Technical approach: keep the existing TypeScript + Svelte + MapLibre +
Vite + Workbox toolchain, no new runtime deps. The only behavioural
change is the SW registration strategy. Tests are TDD — Vitest unit
specs for the update-signal store, the prompt's postpone logic, and a
contrast helper; Vitest integration for the prompt component +
attribution rendering; Playwright E2E for the offline reload flow and
a deterministic update-detected flow using a manually-triggered
`needRefresh` signal.

## Technical Context

**Language/Version**: TypeScript 5.5+ (ES2022 target) — inherited from
001 / 002 / 003.

**Primary Dependencies**:

- `svelte` 4.x (UI; new components reuse the existing toast pattern in
  `App.svelte`).
- `vite-plugin-pwa` 0.20.x (existing — switch `registerType` from
  `'autoUpdate'` to `'prompt'`; consume `virtual:pwa-register/svelte`
  → still works with the existing `virtual:pwa-register` import in
  `src/pwa/registerSW.ts`).
- Workbox runtime served via vite-plugin-pwa (existing; no version
  change).
- **No new runtime deps. No new test deps.**

**Storage**: No schema change. The persisted shapes
(`pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1`) stay
unchanged. Two **transient in-memory** records (not persisted) are
introduced:

- `UpdatePromptState` — `{ visible: boolean; postponedUntil: number |
  null }` in `src/pwa/updateSignal.ts` (a Svelte writable).
- `OfflineReadyState` — a single boolean ("toast already shown this
  session") tracked alongside; the SW activation event is the source
  of truth for the underlying capability.

The "show offline-ready toast exactly once per install lifetime" rule
(SC-008) requires a tiny additive flag — `pwa_map:offlineReadyShown:
boolean` keyed in `localStorage`. That key is **separate from**
`pwa_map:prefs` so it does not need additive-schema accommodation.
Defaults: absent → unshown → toast fires on next SW activation.

**Testing**: Vitest (unit + integration) + Playwright (E2E).
- E2E offline flow: `page.context().setOffline(true)` then `reload()`;
  assert app shell + a previously-cached tile both render.
- E2E update flow: drive `useRegisterSW` mock by dispatching
  `needRefresh` directly via a test-only window hook (the actual SW
  upgrade lifecycle is too slow + flaky for E2E; the test-only hook
  produces a deterministic `needRefresh = true` signal that the
  registration code consumes the same way as a real SW transition).

**Target Platform**: Same as 001–003 — Chrome 120+, Edge 120+, Firefox
120+, Safari 17+; Android 10+, iOS 15+.

**Project Type**: Single project — extension of the existing PWA. No
backend, no new package boundary.

**Performance Goals**:

- Offline cold-start (US1 / SC-001): cached app shell + first cached
  tile painted ≤ **3 s** from `navigationStart` on a mid-range mobile
  device.
- Update detection (US2 / SC-002): update prompt visible ≤ **10 s**
  from the moment the SW reaches `waiting`.
- Postpone-window: 30 min (US2 / SC-003) — pure timer, no measured
  budget needed beyond "no forced reload during window".
- Cumulative bundle delta (SC-007): main JS bundle gzipped delta from
  feature 003 ≤ **3 KB**.

**Constraints**:

- Total JS bundle (gzipped, initial load): unchanged ceiling of ≤
  200 KB; delta from feature 003 ≤ 3 KB (SC-007).
- WCAG AA contrast (Principle III + ADR 0014) preserved AND fixed for
  the attribution badge (currently failing in dark mode).
- No new runtime network dependency. No new SW cache buckets — reuse
  the three from feature 003 (`osm-tiles`, `nlsc-tiles`,
  `google-tiles`) plus the implicit `workbox-precache-*` for app
  shell.
- localStorage schema stability (ADR 0021): `pwa_map:prefs`,
  `pwa_map:lastView`, `pwa_map:gotoHistory_v1` shapes unchanged. The
  new `pwa_map:offlineReadyShown` is a separate key.
- Constitution Locale conventions: any new i18n key uses `zh / en /
  ja` only — no `zh-TW`, `zh-Hant`, etc.

**Scale/Scope**:

- 1 new toast component (`UpdatePrompt.svelte`).
- 1 new module (`src/pwa/updateSignal.ts` — Svelte writable + small
  postpone-window helper).
- 2 amended modules (`src/pwa/registerSW.ts`,
  `src/components/AttributionBar.svelte`).
- 1 amended config (`vite.config.ts` — registerType + dev manifest
  middleware).
- 4 new i18n keys × 3 locales = 12 string additions.
- 2 new ADRs (registration strategy; dev manifest fixture).
- 1 amended ADR or 1 new UI record under `docs/ui/0004-*.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                            | Verdict          | Justification |
| ---------------------------------------------------- | ---------------- | ------------- |
| **I. Code Quality & Formatting**                     | PASS             | New files (TS + Svelte) ride the existing Prettier + ESLint flat config. `npm run format` mandatory after edits per Development Workflow. |
| **II. Test-First Development (NON-NEGOTIABLE)**      | PASS             | All four user stories get failing tests before implementation: unit (`updateSignal`, contrast helper, postpone timer), integration (`UpdatePrompt` rendering, AttributionBar swatch), E2E (`offline reload`, `update prompt`). Tests-before-implementation enforced in tasks.md per Outline §6. |
| **III. User Experience Consistency**                 | PASS w/ doc      | Two visible UI changes (attribution colour fix + new update-prompt toast). New `docs/ui/0004-offline-pwa-polish.md` mandatory before merge — entry deferred to `/speckit.implement` per existing pattern. The update prompt reuses `App.svelte`'s `.toast` token and the existing `role="status" aria-live="polite"` pattern; the attribution change is a token swap with no layout effect. |
| **IV. Performance Requirements**                     | PASS             | Three explicit budgets in **Performance Goals** above (SC-001 / SC-002 / SC-007). All are measurable: SC-001 + SC-007 verified via Playwright + bundle-size CI; SC-002 via the deterministic test-only `needRefresh` hook. |
| **V. Documentation & ADRs**                          | PASS w/ doc      | Two new ADRs planned: ADR 0023 (registration strategy: `autoUpdate` → `prompt`) and ADR 0024 (dev manifest middleware fixture). ADR index updated post-implement. The attribution-bar fix supersedes ADR 0014's contrast guarantee for one selector — recorded as an "Implementation outcome" amendment to 0014 rather than a new ADR. |

**Locale convention compliance** — every new i18n key uses the existing
`zh / en / ja` locales verbatim. No new locale identifier introduced.

**Result**: All five principles pass on the planned design. No
unjustified violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-offline-pwa-polish/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output
├── contracts/
│   ├── update-signal.md                   # Svelte store API + lifecycle
│   ├── update-prompt.md                   # UpdatePrompt component contract
│   ├── attribution-tokens.md              # New CSS token contract + contrast spec
│   └── dev-manifest-middleware.md         # Vite middleware behaviour spec
├── checklists/
│   └── requirements.md                    # /speckit.specify output (already exists)
└── tasks.md                               # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   ├── App.svelte                          # AMENDED — wire UpdatePrompt + offlineReady toast
│   └── tokens.css                          # AMENDED — new --attribution-bg / --attribution-fg pair, both schemes
├── components/
│   ├── AttributionBar.svelte               # AMENDED — switch to new tokens; opacity raised
│   └── UpdatePrompt.svelte                 # NEW — toast with Update/Later actions
├── pwa/
│   ├── registerSW.ts                       # AMENDED — wire onNeedRefresh + onOfflineReady to updateSignal
│   └── updateSignal.ts                     # NEW — Svelte writable + postpone-window helper
├── i18n/
│   ├── zh.json                             # AMENDED — pwa.update.* + pwa.offline.ready keys
│   ├── en.json                             # AMENDED — same keys
│   └── ja.json                             # AMENDED — same keys
└── (no other source files touched)

tests/
├── unit/
│   ├── pwa/
│   │   └── updateSignal.spec.ts            # NEW — postpone window, signal lifecycle
│   └── components/
│       └── AttributionBar.spec.ts          # NEW — contrast token assertions (light + dark)
├── integration/
│   ├── update-prompt.spec.ts               # NEW — UpdatePrompt rendering + button wiring
│   └── attribution-contrast.spec.ts        # NEW — runtime contrast against getComputedStyle
└── e2e/
    └── story-4-offline-and-update.spec.ts  # NEW — offline reload + update prompt flow

docs/
├── ui/
│   └── 0004-offline-pwa-polish.md          # NEW — UI record per Principle III
└── adr/
    ├── 0023-sw-registration-strategy.md    # NEW — autoUpdate → prompt
    └── 0024-dev-manifest-middleware.md     # NEW — dev-mode manifest pattern
    # plus an Implementation outcome amendment to 0014-accessibility-baseline.md

vite.config.ts                              # AMENDED — registerType + dev manifest middleware
```

**Structure Decision**: Single-project layout (Option 1 from the
template) — same as features 001–003. No new package boundaries, no
new top-level directories. Each new file lives next to existing peers
(`src/components/*`, `src/pwa/*`, `tests/unit/{pwa,components}`,
`tests/integration`, `tests/e2e`, `docs/{ui,adr}`).

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | (none)     | (none)                              |
