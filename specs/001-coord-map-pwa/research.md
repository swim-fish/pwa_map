# Phase 0 Research: Taiwan Coordinate Map (PWA)

**Feature**: `001-coord-map-pwa`
**Date**: 2026-04-24

This file records the decisions taken to resolve every unknown in the
Technical Context section of `plan.md` before Phase 1 design. Each entry
states the decision, why it was chosen, and what alternatives were rejected
(and why). These entries will be promoted to ADRs under `docs/adr/` during
`/speckit.implement` per Constitution Principle V.

---

## R1. UI framework

- **Decision**: Svelte 4.x (no SvelteKit — plain `@sveltejs/vite-plugin-svelte`).
- **Rationale**:
  - Compiled output — no runtime framework payload, which makes the 200 KB
    gzipped JS budget (Performance Goals, Principle IV) realistic without
    cutting features.
  - Reactive store model suits the "crosshair position → N coordinate
    readouts" fan-out cleanly; avoids hand-wired observer code.
  - First-class TypeScript support via `svelte-preprocess` + Vite, matching
    our language choice.
  - Single-file `.svelte` components pair naturally with the small component
    surface (6 components) — no need for SvelteKit routing.
- **Alternatives considered**:
  - **Preact**: ~10 KB runtime but still ships a runtime; reactive story is
    weaker than Svelte stores; JSX adds a second parser.
  - **Lit (Web Components)**: strong standard alignment but verbose reactive
    glue for derived state; styling story requires explicit CSS-in-JS or
    Shadow DOM; slower iteration than Svelte HMR.
  - **Vanilla TS + Web Components**: smallest bundle but hand-building the
    store / diff layer is re-implementing Svelte badly and costs time that
    Principle II (TDD) would otherwise spend on tests.
  - **React**: ~45 KB baseline + ecosystem pull; overshoots the bundle
    budget before we write any product code.
  - **SvelteKit**: adds router, SSR, endpoints we don't need for a
    purely-client PWA; extra surface violates "don't design for
    hypothetical future requirements".

---

## R2. Map engine

- **Decision**: MapLibre GL JS 3.x.
- **Rationale**:
  - GPU-accelerated rendering underpins the "≥ 10 Hz during pan" success
    criterion (SC-007, US1.AS3) without hand-tuning.
  - Reference document §10 cross-verified MapLibre GL JS 3.x as a working
    viewer for OSM Standard, NLSC WMTS, Stadia Maps, and Mapbox — giving us
    runway for future tile-source swaps without a second viewer rewrite.
  - Supports both raster (XYZ, the OSM path we use on day 1) and vector
    tiles (future-proof for NLSC vector / Mapbox).
  - MIT-licensed, no API-key required for the OSS engine itself.
- **Alternatives considered**:
  - **Leaflet 1.9**: smaller (~40 KB) and battle-tested for raster tiles
    but renders via DOM tiles; continuous-pan coordinate redraw is jerkier
    on mid-range Android than WebGL-backed MapLibre in our reference
    benchmarks (not reproduced here — relies on §10 of the reference doc).
  - **OpenLayers 9**: more features than we need; ~200 KB gzipped by
    itself would blow the total bundle budget.
  - **Google Maps JS API**: prohibited by ToS for third-party tile sources
    in a PWA; referer-enforced on tiles (§10 table); commercial-licence
    trap. Rejected.
  - **Mapbox GL JS**: API-identical ancestor of MapLibre, but SaaS
    telemetry + mandatory access token push it into commercial territory
    that isn't justified for a Taiwan-only open-data product.

---

## R3. Base tile source (day-1 default)

- **Decision**: OSM Standard (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Rationale**:
  - Reference document §10: CORS `ok`, no referer requirement, full Taiwan
    coverage including outlying islands, attribution-only licence — the
    exact intersection of "PWA-friendly" and "zero upstream coordination".
  - Matches the §10 Decision Flow recommendation: "If you need a PWA /
    browser map with zero tile-proxy setup → OSM Standard".
  - `© OpenStreetMap contributors` attribution string is short and renders
    in the fixed `AttributionBar` component without wrapping on mobile.
- **Alternatives considered**:
  - **NLSC WMTS (EMAP/PHOTO/B100000)**: government-open, Taiwan-specific,
    offline-cache-friendly; but CORS is `unknown-not-tested` per §10 — we
    may need a tile proxy to adopt it safely, and that is a production
    infra dependency outside this feature's scope. Deferred to a future ADR.
  - **Stadia Maps**: CORS ok but commercial-agreement-required; rejected
    for day 1.
  - **Esri World Imagery**: CORS ok, full coverage, attribution-only; kept
    as a toggle option in a future increment (not MVP) because imagery
    layers hurt text legibility for coordinate overlays.
  - **OpenTopoMap**: CORS ok but tile density hurts visual parsing of
    coordinate crosshair at low zoom; rejected as default, kept as
    optional layer.
  - **Mapbox / Google**: referer-locked or commercial; rejected (same
    reasoning as R2).
- **Followup**: During `/speckit.implement`, allow the tile source to be
  swapped via a single config surface (`src/map/tileSource.ts`) so the NLSC
  swap becomes a one-file change once CORS is proven.

---

## R4. Coordinate conversion libraries

- **Decision**:
  - `proj4` (npm, v2.x) for WGS84 ↔ TWD97 TM2 zone 121 (EPSG:3826) and zone
    119 (EPSG:3825). `proj4.defs()` is called once at app start with the
    canonical proj4 strings from reference §4 and §5.
  - `mgrs` (npm, v2.x) for WGS84 ↔ MGRS forward and reverse.
  - **Hand-rolled** TWD97 ↔ TWD67 four-parameter transform (reference §6)
    and TWD67 ↔ Taipower encoder/decoder (reference §8). Reason: both are
    Taiwan-only and the off-the-shelf `EPSG:3828` proj4 entries on the web
    often omit the Bursa-Wolf / four-parameter shift, producing a ~400 m
    systematic error (warning in reference §6 "Implementation notes").
    Hand-rolling from the documented formulas is ~40 lines each and fully
    test-vector-driven.
  - WGS84 DD ↔ DMS: **hand-rolled** (reference §3). The formula is trivial
    and avoids pulling in a fourth dependency for five lines of math.
- **Rationale**:
  - Splits "well-trodden global math" (proj4, mgrs — both widely audited)
    from "Taiwan-specific math that third parties get subtly wrong" (four-
    parameter, Taipower). Minimises trust surface while maximising
    correctness.
  - Every conversion is covered by at least one vector in
    `test-vectors.json` v2.0.0; TDD is therefore feasible (Principle II).
  - Both `proj4` and `mgrs` are tree-shakable; Vite picks only the
    TransverseMercator forward/inverse plus the MGRS encoder, keeping the
    bundle budget achievable.
- **Alternatives considered**:
  - **All-in proj4 (including EPSG:3828)**: rejected for the TWD67 reason
    above — silent 400 m error in most off-the-shelf proj4 entries.
  - **WebAssembly port of PROJ**: submetre accuracy but adds 500 KB+ wasm;
    overkill for ±3 m TWD67 and ±0.1 m TWD97 targets.
  - **Implementing TM2 ourselves**: re-derives Snyder (1987) series; not
    worth the maintenance cost vs. calling a vetted library.

---

## R5. Build / dev tooling

- **Decision**: Vite 5.x with `@sveltejs/vite-plugin-svelte` and
  `vite-plugin-pwa` (Workbox under the hood).
- **Rationale**:
  - Vite + Svelte + TS is a first-class path with near-zero config.
  - `vite-plugin-pwa` generates the service worker (via Workbox) plus the
    web app manifest and injects the registration script — covers
    FR-012 and SC-006 without bespoke PWA scaffolding.
  - `import.meta.glob` makes loading `test-vectors.json` trivially
    hot-reload-friendly during test authoring.
- **Alternatives considered**:
  - **Webpack + sveltie-loader**: slower cold start; extra config surface;
    no advantage.
  - **Rspack / esbuild direct**: faster builds but PWA plug-in ecosystem
    is thinner; we'd have to wire Workbox by hand.
  - **Parcel**: good DX but Svelte first-class support lags; rejected.

---

## R6. Testing strategy

- **Decision**:
  - **Vitest** for unit + contract tests. Loads `test-vectors.json` via
    JSON import, iterates vectors with `test.each`, and asserts
    tolerance-aware equality (custom matcher, see contracts/test-vectors.md).
  - **Playwright** for E2E. One spec file per user story
    (`tests/e2e/story-*.spec.ts`). Uses a real headless Chromium for PWA
    install / offline-after-install behaviours and to validate real
    MapLibre rendering.
  - **Vitest benchmarks** for the per-conversion time budget (≤ 1 ms).
- **Rationale**:
  - Vitest is Vite-native — test runs re-use the app's Vite config, so
    Svelte preprocess + TS + path aliases "just work".
  - Test vectors come from a pinned JSON schema; driving tests from that
    file means every tolerance is verifiable and drift between code and
    reference is caught on the first CI run after a reference upgrade.
  - Playwright drives PWA install + offline scenarios that JSDOM cannot
    reproduce — essential for FR-012 and SC-006.
- **Alternatives considered**:
  - **Jest + jsdom**: slower, needs manual TS/Svelte plumbing; also
    cannot test service workers realistically.
  - **Playwright component testing**: works but still needs Vitest for
    pure-function coord math; two test runners are worse than one (Vitest)
    + one end-to-end runner (Playwright).
  - **Cypress**: good DX but larger test-harness footprint; Playwright's
    multi-browser story is better for this PWA.

---

## R7. Linting & formatting

- **Decision**: Prettier (formatter) + ESLint with `typescript-eslint` and
  `eslint-plugin-svelte` (linter). `npm run format` == `prettier --write .`;
  `npm run lint` == `eslint . --max-warnings 0`.
- **Rationale**:
  - Constitution Principle I demands an enforced formatter (the `dart
    format` example is illustrative of the discipline, not the tool). In
    a TS/Svelte stack, Prettier is the equivalent default.
  - ESLint with `typescript-eslint` catches unused imports, any-typed
    drift, and React-isms that don't apply to Svelte.
  - `eslint-plugin-svelte` lints `.svelte` files with the same rule set.
- **Alternatives considered**:
  - **Biome**: one tool for both; moving target in 2026, plugin ecosystem
    thinner than ESLint's; rejected for MVP, re-evaluate in the
    pwa-map 2.0 milestone.
  - **Rome / dprint**: abandoned (Rome) or niche (dprint); not worth the
    transition cost.

---

## R8. Storage for user preferences

- **Decision**: `localStorage` with a JSON schema guard.
- **Rationale**:
  - Only two pieces of persisted state (visible formats, last map view).
  - Synchronous API; no async plumbing needed in the store.
  - Works offline out of the box; no extra PWA wiring.
- **Alternatives considered**:
  - **IndexedDB (via `idb-keyval`)**: async overhead for two scalars;
    overkill.
  - **Cookies**: bounded size (4 KB) and sent with every request —
    inappropriate for client-only state.

---

## R9. Internationalisation

- **Decision**: Minimal custom i18n — a Svelte store that reads the active
  locale from `{zh,en,ja}.json` (JSON files colocated under
  `src/i18n/`), with `zh` as the default and the canonical key set.
  Missing keys fall back: `ja → en → zh`. Locale choice is persisted
  in `FormatPreferences.locale` (`data-model.md §7`).
- **Rationale**:
  - Three locales × ~40 strings ≈ 120 entries total. A plain Map plus
    Svelte reactivity handles this; no third-party library needed.
  - Keeps bundle lean. `svelte-i18n` adds ~12 KB; `intl-messageformat`
    another ~20 KB — both rejected because our strings don't need
    ICU-MessageFormat plurals beyond what `Intl.NumberFormat` /
    `Intl.DateTimeFormat` (available natively in every target browser)
    already provide.
  - `ja` adds a third locale but not a third mechanism: the same store,
    the same key catalogue (see `contracts/go-to-grammar.md §3`), one
    extra JSON file.
  - Locale switching fires a simple store update; no URL routing needed.
    The map canvas and coordinate numerals are locale-invariant, so a
    switch re-renders labels only — zero layout shift, no map reload.
  - CJK-specific concerns: zh and ja share Han glyphs but not
    readings; translations MUST be authored independently (no zh →
    ja machine gloss). Japanese full-width glyphs are accepted by the
    text-input stack out of the box (Svelte / browser); the Go-To
    parser still rejects full-width digits (`０`, `１`, etc.) as
    `malformed` per reference §3 — this is a *Go-To input* rule, not a
    UI-text rule.
- **Alternatives considered**:
  - **`svelte-i18n`**: more features (pluralisation DSL, interpolation
    namespaces, lazy-loaded locale chunks) than we need at ~40 keys × 3
    locales; rejected.
  - **Hard-coded zh**: violates FR-009's "human-readable message"
    obligation for English-speaking and Japanese-speaking users;
    rejected.
  - **Auto-detect from `navigator.language`**: kept as the *initial*
    choice when `FormatPreferences.locale` is unset, but the explicit
    user selector always wins. Auto-detect is a convenience, not a
    contract.
  - **Translation service at runtime** (e.g., calling an LLM for `ja`):
    rejected — violates the offline guarantee (FR-012) and adds a
    privacy surface.

---

## R10. Go To parser strategy

- **Decision**: Dispatch parser that tries grammars in this order — WGS84
  DD → WGS84 DMS → MGRS → TWD97 TM2 (zone-declared) → TWD97 TM2
  (inferred) → TWD67 TM2 → Taipower. First format whose input grammar
  (reference §3–§8) accepts the raw string wins. If every grammar
  rejects, the most specific rejection reason is returned (preferring
  `out-of-range` over `malformed`).
- **Rationale**:
  - Matches the reference document's stated grammars verbatim — no heuristic
    cleaning.
  - The first-accepting-grammar policy avoids a classifier (no ML), so the
    parse is deterministic and unit-testable with a static set of
    fixtures.
  - `out-of-range` preference produces the most actionable error for the
    user (they typed a Taiwan-plausible number but it's wrong).
- **Alternatives considered**:
  - **Classifier heuristic** (e.g., "starts with two digits and a letter →
    MGRS"): faster but brittle; a TWD97 easting starting with `51` could
    be misclassified.
  - **Explicit format selector dropdown in Go To**: moves parse decision
    to the user; more clicks; rejected for MVP, but the parser emits the
    detected format so a future ADR may add the dropdown as an override.

---

## R11. TM2 zone ambiguity resolution

- **Decision**: When Go To receives a TM2 E/N pair without an explicit
  zone, apply reference §9's rule after an inverse projection pass
  against **both** zones. The result whose back-projected longitude
  satisfies the `lon ≥ 120° E → zone 121` / `lon < 120° E → zone 119`
  rule is accepted; if both satisfy their rule, prefer zone 121
  (per §9 default). Surface the chosen zone in the UI (FR-016).
- **Rationale**:
  - Matches the reference document's canonical resolution precisely.
  - The back-project test is cheap (≤ 2 proj4 calls) and unambiguous.
  - Exposing the chosen zone prevents silent wrong-zone navigation (the
    two-projection results differ by ~205 km per §9 worked example).
- **Alternatives considered**:
  - **Require explicit zone**: stricter, but §5 Input grammar lists zone
    declaration as SHOULD, not MUST; rejecting would be over-strict.
  - **Guess by easting magnitude alone**: breaks at the Penghu / main
    overlap; rejected.

---

## R12. Taipower coverage scope for MVP

- **Decision**: MVP supports main-island Taipower letters A–X only.
  Leading letter `Y` (Penghu) or `Z` (Kinmen/Matsu) → rejection with
  category `out-of-coverage` (reference §8 out-of-coverage table).
- **Rationale**:
  - Reference document v2.0.0 does not provide anchors for Y/Z; a
    silent-pass implementation would produce bogus cells.
  - Matches the spec's Edge Cases bullet on outer-island Taipower.
- **Alternatives considered**:
  - **Hand-add Y/Z anchors from third-party sources**: requires
    provenance review; out of scope for this feature. Tracked as a
    future enhancement (separate feature spec).

---

## R13. Performance verification pipeline

- **Decision**:
  - Bundle-size budget enforced via a post-build script (`scripts/
    check-bundle-size.js`) that fails CI if `dist/assets/*.js` (gzipped)
    exceeds 200 KB or `*.css` exceeds 20 KB.
  - Lighthouse CI on every PR, asserting PWA score ≥ 90 and "Time to
    Interactive" ≤ 3 s on a simulated fast-3G baseline.
  - Vitest benchmark suite (`bench/coord.bench.ts`) asserts single-point
    conversion time ≤ 1 ms.
  - A Playwright perf probe records FPS during a scripted 5-second pan
    and fails if median < 10 Hz readout updates.
- **Rationale**: Principle IV mandates explicit budgets and CI
  verification; none of the budgets above are enforceable without these
  scripts.
- **Alternatives considered**:
  - **Manual profiling only**: violates Principle IV (must be automated
    or checklisted). Rejected.

---

## R14. Accessibility baseline

- **Decision**:
  - The crosshair reticle has `role="img"` and an `aria-label` that
    reflects the current coordinate (e.g., "Crosshair at 25.0336° N,
    121.5645° E — over land").
  - The coordinate readout is wrapped in `aria-live="polite"` so a screen
    reader announces updates on pan-end (not during continuous pan —
    would flood the reader).
  - Go To input uses a `<label for=...>` + description; error messages
    appear in an `aria-live="assertive"` region.
  - Colour tokens meet WCAG AA contrast on both light and dark tile
    backgrounds; crosshair outline has a 1 px dark + 1 px light halo so
    it remains visible on both imagery and topo tiles (imagery toggle is
    a future increment, but we design for it now).
  - All interactive controls reachable by keyboard; `Tab` order is
    MapView → Go To trigger → FormatToggle trigger.
- **Rationale**: Principle III requires accessibility consideration for
  every UI change, and doing it up-front is cheaper than retrofitting.
- **Alternatives considered**:
  - **`aria-live="assertive"` for the readout**: too noisy; makes the
    page unusable during pan for screen-reader users. Rejected.
  - **Skip accessibility until v1.1**: violates Principle III. Rejected.
