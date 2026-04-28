# Contract: `styleBuilder.applyLockdown` — strip disallowed 3D / Terrain layer types from the assembled MapLibre style

**Feature**: 012-settings-about-and-mobile-fixes
**Module**: `src/map/styleBuilder.ts` (MODIFIED)
**Consumed by**: `src/components/MapView.svelte` (via `buildStyle`)
**Spec FRs**: FR-003 (`sky`), FR-006 (`fill-extrusion`), FR-007 (`hillshade`), FR-008 (lockdown survives style swap)
**Related ADRs**: ADR-0020 (map source catalogue), ADR-0032 (NEW — three-d-lockdown register)

## §1. Public surface

```ts
// src/map/styleBuilder.ts

export function buildStyle(
  basemap: MapLayerOption,
  overlay: MapLayerOption | null,
): StyleSpecification;
```

The public signature is unchanged from feature 003 (ADR-0020). The
filter behaviour is added as an **internal post-processing step**
inside the function body — callers see the same type and the same
async-vs-sync semantics.

## §2. Behaviour

### Pre-filter (existing behaviour, unchanged)

The function assembles a `StyleSpecification` object from the basemap
and overlay arguments, identical to feature 003's logic.

### Post-filter (NEW — this feature)

After assembly and before returning, the function calls an internal
`applyLockdown(style)` helper that:

1. **Strips top-level `sky`**: if `LOCKDOWN_REGISTER.sky.lockedValue
   === false`, `delete` the `style.sky` property if it is set.
2. **Filters layers by type**: if any of
   `LOCKDOWN_REGISTER.fillExtrusion.lockedValue` or
   `LOCKDOWN_REGISTER.hillshade.lockedValue` is `false`, the helper
   builds a `Set<string>` of disallowed layer types and replaces
   `style.layers` with the filtered array. Order of remaining layers
   is preserved.

The helper is purely transformational and synchronous. It does not
log, throw, or warn — the lockdown is silent at runtime; visibility
is achieved via the test suite (per research.md §R3).

## §3. Invariants

### I1 — Idempotent

`applyLockdown(applyLockdown(style))` MUST produce the same result as
`applyLockdown(style)`. The filter is set-based, so re-running it on
already-filtered output is a no-op.

### I2 — Order-preserving

For the layers that survive the filter, their relative order MUST
match their relative order in the input. The filter MUST be a single
linear scan (`Array.prototype.filter`), not a re-sort.

### I3 — Source-catalogue read-only

The filter MUST NOT mutate `MAP_SOURCES`, the basemap argument, the
overlay argument, or any frozen object reachable from them. The
input objects are treated as read-only; a new style object is
returned (which is what `buildStyle` already does).

### I4 — No allocation in hot path beyond the filter

`applyLockdown` allocates at most one `Set<string>` (small, ≤ 2
entries) and one new layers array. It MUST NOT allocate per-layer
intermediate objects.

### I5 — Survives style rebuild

Every call to `buildStyle` (including those triggered by basemap or
overlay swaps via `MapView.svelte`'s reactive style hook) MUST run
the filter. The filter is part of the function body, not an opt-in.

## §4. Test contract

### T1 — Strips `sky`

`tests/integration/three-d-lockdown-runtime.spec.ts`:

```ts
const fakeBasemap: MapLayerOption = { ...realOsmStandard };
const built = buildStyle(fakeBasemap, null);
// Inject a sky key after assembly to simulate a style mutation
// upstream — the contract is that *if* the lockdown is on, the
// returned style has no `sky` key.
expect((built as { sky?: unknown }).sky).toBeUndefined();
```

A second case wraps `buildStyle` to verify the filter survives
re-call: built twice, no `sky` key either time.

### T2 — Strips `fill-extrusion` and `hillshade` layers

The test extends `buildStyle`'s output by appending synthetic layers
of each disallowed type (via a wrapper that simulates an upstream
basemap definition that included them), then re-runs the filter
through a public hook (a re-export of `applyLockdown` for testing)
and asserts the layer list is reduced.

```ts
import { __test_applyLockdown } from '$map/styleBuilder';
const polluted: StyleSpecification = {
  ...realStyle,
  layers: [
    ...realStyle.layers,
    { id: 'fake-extrusion', type: 'fill-extrusion', source: 'x' } as never,
    { id: 'fake-hillshade', type: 'hillshade', source: 'x' } as never,
  ],
};
__test_applyLockdown(polluted);
expect(polluted.layers.find((l) => l.type === 'fill-extrusion')).toBeUndefined();
expect(polluted.layers.find((l) => l.type === 'hillshade')).toBeUndefined();
```

`__test_applyLockdown` is a named test-only export (similar to the
project's existing `__resetForTests` pattern in
`installSettingsSurface.ts`). It MUST NOT appear in production
consumer paths.

### T3 — Order preservation

The polluted-input test in T2 also asserts the surviving layers
appear in their original relative order (e.g., `osm-standard-layer`
appears before any other surviving layer).

### T4 — Idempotence

`applyLockdown(style); applyLockdown(style)` produces the same
`style.layers.length` and `style.sky === undefined` as one call.

### T5 — Style rebuild path

`tests/integration/three-d-lockdown-runtime.spec.ts` (same file as
T1–T4):

- Mounts `MapView.svelte`.
- Toggles `layer` prop to swap basemap; waits for style rebuild.
- Asserts `map.getStyle().sky` is `undefined` and no surviving layer
  has `type` in `['fill-extrusion', 'hillshade']`.
- Repeats with overlay toggled on / off.

## §5. Failure modes

| Scenario | Behaviour |
|----------|-----------|
| Upstream basemap definition introduces a `'circle'` or `'symbol'` layer that we *want* to keep | Filter only blocks types listed by `LOCKDOWN_REGISTER`. New types pass through unchanged. |
| Upstream basemap definition introduces a new 3D layer type (e.g., a hypothetical `'mesh3d'`) | Filter does NOT catch it (the registry doesn't list it). Mitigation: the registry's `LockdownClass` union must be extended in the same release that picks up the new MapLibre version (per spec Assumptions). |
| Caller passes a hand-crafted style directly to `map.setStyle(...)` bypassing `buildStyle` | Out of scope for this contract. The lockdown register's policy is enforced through `buildStyle`; bypass paths are caught by code review and by ESLint usage rules. |
| `applyLockdown` mutates the input | Forbidden by I3. `MAP_SOURCES` and basemap / overlay arguments must remain referentially unchanged. Test asserts `Object.isFrozen(MAP_SOURCES[i])` after `buildStyle` is called. |
