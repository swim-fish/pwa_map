# Phase 0 Research — Settings About + Mobile Fixes + 3D / Terrain Lockdown

**Feature**: 012-settings-about-and-mobile-fixes
**Date**: 2026-04-28
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

This document resolves open decisions raised by the spec and the plan
so that Phase 1 (data model + contracts + quickstart) can be authored
without further `NEEDS CLARIFICATION` markers. The plan above has zero
remaining markers; the entries below document **why** each decision
was chosen.

## R1 — Engineering shape of the lockdown register

**Decision**: A single TypeScript module at `src/map/threeDLockdown.ts`
exports an `Object.freeze`d immutable registry. Three call sites
(`MapView.svelte`, `styleBuilder.ts`, `src/map/sources.ts`) `import`
the registry and consume its values directly. No runtime escape hatch.

**Rationale**:

- Authoritatively settled by `/speckit.clarify` Q2 (Option A). The
  user's explicit request was "整理出來 ... 已[以]方便後續可以重新啟用"
  — *catalog so re-enable is easy* — which a single source of truth
  satisfies and a distributed solution does not.
- Three downstream consumers all need the same set of keys (pitch
  ceiling, sky-allow flag, projection, terrain-allow, fill-extrusion
  allow, hillshade allow). Sharing a single literal object eliminates
  drift; each consumer's locked behaviour is mechanically derived.
- A TS `const` + `Object.freeze` gives compile-time and runtime
  immutability without a class hierarchy or DI framework. Bundle
  delta is < 0.5 KiB gzipped.
- Test ergonomics: `tests/unit/three-d-lockdown.spec.ts` can `import`
  the registry directly and assert its shape (key set + locked
  values + re-enable hint shape). No mocking required.

**Alternatives considered**:

- **Distributed config + ADR-only documentation**: cheaper to author
  initially but creates a "scavenger hunt" experience for the
  re-enabler. Explicitly rejected by Q2 (Option C).
- **Centralised constants used as documentation only (no runtime
  import)**: Q2 Option D. Rejected — leaves the same drift hazard as
  fully distributed because nothing mechanically prevents call sites
  from diverging from the constants.
- **Feature flag (env var or build-time constant)**: Q2 Option B.
  Rejected — the user's directive "目前版本先關閉，避免誤觸" implies
  the lockdown is the durable invariant; an escape hatch invites the
  exact accidental enablement we are guarding against.

## R2 — MapLibre option coverage for pitch lockdown

**Decision**: Construction options are `maxPitch: 0` plus
`touchPitch: false`. The `dragRotate` handler stays enabled (rotation
is in scope; pitch is not — the ceiling clamps any pitch component a
drag-rotate gesture would otherwise apply). Keyboard pitch shortcuts
(<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>) are clamped by
`maxPitch: 0` without disabling the keyboard handler entirely (so
panning + rotation keyboard shortcuts continue to work).

**Rationale**:

- `maxPitch: 0` is the engine-level ceiling and covers programmatic
  `setPitch(>0)` calls — defence against a future regression where
  someone calls `setPitch` directly. No call-site decoration needed.
- `touchPitch: false` is the explicit gesture-disable — doesn't
  rely solely on the ceiling. Belt-and-braces against any code path
  that briefly suspends the ceiling.
- Drag-rotate is the right-mouse-button gesture in MapLibre. With
  `maxPitch: 0`, the rotation component still works; the pitch
  component clamps to 0. We verified this against the MapLibre v4.x
  source semantics.
- Keyboard handler stays enabled because we still want arrow-key
  panning and `Shift`+`←`/`→` rotation. The pitch shortcuts no-op
  thanks to the ceiling, which is the desired behaviour.

**Alternatives considered**:

- **Disable `keyboard` entirely**: rejected — would also disable
  keyboard pan / rotate, regressing accessibility (Constitution
  Principle III).
- **Disable `dragRotate`**: rejected — would lose right-mouse rotation
  on desktop, regressing the existing compass-aligned bearing UX.
- **Re-implement gesture handlers**: rejected — out of scope and
  high risk for a P1 lockdown.

## R3 — Style filter mechanism for `sky` / `fill-extrusion` / `hillshade`

**Decision**: `styleBuilder.buildStyle` post-processes its output:
(a) the assembled `style.layers` array is filtered to drop any entry
whose `type` is `'fill-extrusion'` or `'hillshade'`; (b) the assembled
top-level `style.sky` key is unconditionally `delete`d (or never set,
which is the current path). The filter rules are derived by reading
keys off `LOCKDOWN_REGISTER` so adding a new disallowed layer type to
the register automatically extends the filter. The basemap source
catalogue (`src/map/sources.ts`) is **not** mutated — the catalogue
remains read-only / immutable; filtering happens at style-assembly
time, not at source-registration time.

**Rationale**:

- Today's catalogue defines only raster basemaps with no `sky`,
  `fill-extrusion`, or `hillshade` entries. The filter is therefore
  preventive — it costs ~10 LoC and ~0.1 KiB gzipped, and it closes
  the door on future basemap definitions (or upstream basemap-style
  imports) that ship those entries.
- Filtering at build time keeps the catalogue read-only, which
  matches the existing `Object.freeze` invariants on `MAP_SOURCES`.
- Reading filter rules off `LOCKDOWN_REGISTER` keeps the registry
  the single source of truth — adding a hypothetical 7th class
  later is one register entry plus the filter automatically picks
  it up.

**Alternatives considered**:

- **Mutate the catalogue at source-registration time**: rejected —
  breaks the catalogue's read-only invariant and disperses lockdown
  logic across two modules.
- **Runtime check on map.getStyle() after every `setStyle` call**:
  rejected — too expensive (runs on every basemap swap, allocates a
  full style copy) and provides no extra correctness over a build-time
  filter that has 100% coverage of `buildStyle`'s output.
- **Throw on disallowed layer types instead of silently filtering**:
  considered. Spec acceptance scenarios say the filter strips
  silently; throwing would crash the app on a future basemap with a
  hillshade layer, which is worse UX than silently rendering 2D.
  However, a unit test (RED-first) MUST assert the filter triggered
  — silent stripping must be visible to the test suite.

## R4 — Globe-projection lockdown

**Decision**: `MapView.svelte` sets `projection: 'mercator'`
**explicitly** in the MapLibre construction options, even though the
current MapLibre version (v4.x) defaults to mercator. The
`LOCKDOWN_REGISTER.globe` entry's locked value is the literal string
`'mercator'`.

**Rationale**:

- Future MapLibre versions may default `projection` to `'globe'`
  (the `projection` API has been actively evolving). An explicit
  literal pins the projection so a transparent dependency upgrade
  cannot silently flip the app to a globe view.
- The explicit literal also makes the regression test trivial — the
  test asserts `map.getProjection()` equals `'mercator'` after
  construction, and the assertion is decoupled from MapLibre's
  default.

**Alternatives considered**:

- **Rely on MapLibre default**: rejected — fragile against future
  upstream changes; same dependency that just established
  `projection: 'globe'` as a default-able value.
- **Pin to MapLibre v4.x in `package.json`**: complementary, not a
  substitute. Pinning prevents the upgrade hazard at dependency level;
  the explicit literal prevents it at the consumer level. Both belong
  in the supply-chain defence story; only the explicit literal is in
  this feature's scope.

## R5 — Go-To narrow-viewport collapse strategy

**Decision**: Each Go-To layout (`DdLayout`, `DmsLayout`, `Tm2Layout`,
`Twd67Layout`, `MgrsLayout`, `TaipowerLayout`) gains a single
`@media (max-width: calc(360px - 0.02px))` block that switches its
`grid-template-columns` to `1fr` (single column). The 360 px threshold
captures the iPhone SE / split-screen Android territory while leaving
larger phones (≥ 360 px width, e.g. iPhone 12+ in portrait) on the
existing 2- or 3-column layout. `AutoLayout` does not need a collapse
since its single text input already spans the full width.

**Rationale**:

- The `0.02 px` rounding hazard from `.claude/rules/pwa-positioning.md`
  is honoured (single calc-driven breakpoint expression).
- Bundle delta: 6 layouts × ~30 bytes of CSS per `@media` block ≈
  ~180 bytes raw, ~120 bytes gzipped. Well under the +0.5 KiB CSS
  ceiling.
- Single-column at 320 px guarantees a tap target ≥ the full input
  width minus the dialog padding, comfortably > 44 px on every
  reachable viewport.
- The breakpoint at 360 px (not 320 px) means iPhone 12+ in portrait
  still gets the 2-column DD / 3-column DMS layout, which is the
  current desktop UX — no regression at the most common viewport
  width.

**Alternatives considered**:

- **Flex-shrink the inputs without collapsing columns**: rejected —
  shrinks the tap target below 44 px in DMS at 320 px (3 cols × ~80
  px - dialog gutter < 44 px per cell).
- **Per-layout breakpoints (e.g., DMS collapses earlier than DD)**:
  rejected — increases the test matrix surface and CSS volume without
  measurable benefit. A single 360 px breakpoint is the simplest
  shape that satisfies all 6 layouts.
- **A new shared CSS variable** (`--goto-grid-cols-narrow`):
  considered — would centralise the breakpoint. Rejected for now
  because (a) only one variable used in 6 places offers minimal
  reuse benefit, and (b) the breakpoint is unlikely to drift since
  it derives directly from the spec's "320 px is narrowest"
  assumption.

## R6 — Settings About section structure

**Decision**: A new `<section class="about">` placed inside
`SettingsSheet.svelte` after the existing install section and before
the cache-rows footer. The section renders an `<h3>` heading + two
`<a>` links (Live map, Source code). All colours derive from
`--color-fg` (heading + link text), `--color-fg-muted` (subtle
descriptor text if any), and the existing focus-ring tokens. No new
tokens are introduced.

**Rationale**:

- Visual consistency: the existing install section is a `<section>`
  with an `<h3>` + body content. Mirroring that shape minimises new
  CSS and keeps the SettingsSheet's structural rhythm.
- Token reuse satisfies `.claude/rules/pwa-tokens-and-contrast.md`
  ("re-use first") and keeps `settings-contrast.spec.ts` passing
  unchanged — no new colour pair to verify.
- Placement *after* install means the About area does not displace
  the most-actionable section (install) above the fold; placement
  *before* the cache rows means it is reachable without scrolling
  past the noisier cache-status table.

**Alternatives considered**:

- **A separate routed sub-page**: considered (matches the spec's
  literal "頁面" wording). Rejected per the spec's Assumptions —
  the SettingsSheet's existing multi-section pattern is the
  lowest-friction shape and matches established conventions
  (features 007 + 011).
- **Footer-style attribution row**: rejected — too easy to miss; the
  user explicitly asked for an "About" area, which implies a
  recognisable section label, not a thin footer line.

## R7 — README live link placement and form

**Decision**: A two-line change to `README.md` near the top, *before*
the "Quickstart" section, of the form:

```markdown
**Live demo**: <https://swim-fish.github.io/pwa_map/>
```

The `<URL>` autolink form renders as both a clickable link on GitHub
and as a legible URL in plain-text views (CLI viewers, npm package
listings).

**Rationale**:

- The autolink form is the most robust across rendering surfaces.
  GitHub renders it as a clickable link; plain-text viewers render
  the URL verbatim; copy-paste from the rendered page captures the
  URL itself, not a hidden `[text](url)` substitution.
- "Live demo" is the most common idiom for a deployed-app link in
  open-source READMEs and is locale-neutral (the README is English-
  primary per Constitution Principle V).
- Placing the link *before* the Quickstart means a first-time visitor
  sees it within the first ~30 lines (per FR-020's "above-the-fold"
  requirement on a typical desktop reader).

**Alternatives considered**:

- **`[Live demo](https://swim-fish.github.io/pwa_map/)`** (labelled
  Markdown link): considered. Rejected because plain-text rendering
  hides the URL behind the label — defeats the FR-017 "URL still
  legible in CLI viewers" requirement.
- **Placement under a new "Demo" H2 section**: rejected — adds
  structural noise for a one-line change. A bold prefix on a single
  line is sufficient.
- **Bare URL without bold prefix**: rejected — easier to overlook in
  a long README; the bold "Live demo:" anchor improves scannability.

---

**No remaining `NEEDS CLARIFICATION` markers.** The plan and
companion artefacts are unblocked.
