# ADR 0032 — 3D / Terrain Lockdown Register

**Status**: Accepted
**Date**: 2026-04-28
**Feature**: `specs/012-settings-about-and-mobile-fixes/`
**Related**: ADR 0002 (map engine MapLibre), ADR 0020 (map source catalogue)

## Context

The app's central UX premise is a **viewport-centred crosshair reading
coordinates off a strictly top-down 2D projection**. Every coordinate
readout, every Go-To navigation, and every crosshair alignment depends
on the visual relationship between the crosshair pixel and the tile
beneath it being a perfect orthogonal projection.

MapLibre exposes several capabilities that can break this premise —
some by accidental gesture, some by latent default, some by upstream
basemap definitions:

| Capability class                                  | How it breaks the 2D invariant                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pitch` (touch / mouse / keyboard / programmatic) | Tilts the canvas; the crosshair pixel no longer projects orthogonally onto the tile beneath.                      |
| `sky` style layer                                 | Renders an atmospheric haze that only makes sense at non-zero pitch.                                              |
| Globe projection (`projection: 'globe'`)          | Curves the world; latitude/longitude lines become curved, breaking the linear-screen-space model.                 |
| Terrain DEM (`map.setTerrain`)                    | Lifts the surface into 3D, so the crosshair pixel projects onto an elevated point, not the surveyor's chart.      |
| 3D `fill-extrusion` layers                        | Building geometry casts vertical mass into the canvas; on pitch, the crosshair appears to "float".                |
| `hillshade` layers                                | Requires a terrain RGB DEM source, which couples it to the terrain class even though hillshade itself renders 2D. |

User reports of accidental tilt (e.g. unintentional two-finger gesture
on a touch device) had been informal but recurring since launch.
Disabling each capability one-off in scattered call sites (the map
construction options, the source catalogue, the style builder) creates
a "scavenger hunt" experience for any future feature that legitimately
needs to enable 3D — there is no single discoverable surface listing
"what is currently off and where to flip it back on".

## Decision

A new module **`src/map/threeDLockdown.ts`** exports a single
`Object.freeze`d immutable registry as the **single source of truth**
for every MapLibre 3D / Terrain capability the app deliberately keeps
off. Three call sites import the registry at construction / assembly
time:

1. **`src/components/MapView.svelte`** — reads
   `LOCKDOWN_REGISTER.pitch.lockedValue` (passes as `maxPitch`),
   `LOCKDOWN_REGISTER.globe.lockedValue` (passes as `projection`),
   and unconditionally sets `touchPitch: false`. Never calls
   `map.setTerrain(...)`.
2. **`src/map/styleBuilder.ts`** — reads
   `LOCKDOWN_REGISTER.sky` / `.fillExtrusion` / `.hillshade` to
   strip disallowed entries from every assembled style. Survives
   basemap / overlay swaps.
3. **`src/map/sources.ts`** — type-only `import` of `LockdownClass`
   as a JSDoc anchor that forbids registering a terrain RGB DEM
   source while `LOCKDOWN_REGISTER.terrain.lockedValue === null`.
   No runtime use.

The registry exposes six `LockdownEntry<T>` records — one per
capability class — each with:

- `class`: the literal key (`'pitch'` / `'sky'` / `'globe'` /
  `'terrain'` / `'fillExtrusion'` / `'hillshade'`).
- `lockedValue`: the literal-typed locked value (e.g. `0` for `pitch`,
  `false` for the layer-type strips, `'mercator'` for `globe`,
  `null` for `terrain`).
- `reEnableHint`: a one-line operator instruction (≤ 140 chars)
  identifying the call sites that must change to enable that class
  in a future feature.

There is **no runtime escape hatch**. The module reads no environment
variables, no build-time env constants, no browser storage, no URL
query parameters. Re-enabling 3D in a future feature is always a
deliberate code edit on the registry plus removal of the corresponding
filter call site.

## Consequences

### Positive

- **Single discoverable surface**. A future "enable 3D" feature
  starts at `threeDLockdown.ts`, follows the `reEnableHint` text per
  class, and finishes in known call sites.
- **No drift hazard**. Every consumer mechanically derives its
  locked behaviour from the registry; no two call sites can diverge.
- **Compile-time guard**. The narrow literal types
  (`LockdownEntry<0>`, `LockdownEntry<false>`, etc.) mean a future
  edit that changes a value broadens the type — surfacing the change
  at every consumer's call site as a compiler diff.
- **Survives style rebuilds**. The filter step in
  `styleBuilder.applyLockdown` is part of the function body, not an
  opt-in; every basemap / overlay swap re-runs it.
- **Bundle delta within budget**. ~0.4 KiB JS gzipped for the
  module + filter; +0 CSS.

### Negative / cost

- **One extra module to author and maintain**. The existing
  scattered call sites would have been smaller in raw LoC. The
  trade is paid for by the discoverability + drift-resistance
  benefits above.
- **MapLibre v3 `projection` cast**. The current pinned
  `maplibre-gl@^3.6.2` does not expose `projection` on its options
  type; we widen via a one-line cast in `MapView.svelte`. Honest
  cost: one cast + one comment block. The literal becomes
  type-supported when MapLibre v4 lands and the cast can drop.
- **Re-enable cost is small but not zero**. A future feature must
  edit two places (the registry value + the filter call site), not
  one. We accept this as the price of the runtime filter that
  defends against upstream basemap definitions silently
  re-introducing disallowed layers.

### Migration / re-enable contract

A future "enable 3D" feature must:

1. Author a spec under `specs/<NNN>-<slug>/` that names the
   capability class(es) being re-enabled and the user-visible
   surface (e.g. a Settings toggle).
2. Edit `LOCKDOWN_REGISTER.<class>.lockedValue` to a non-locked
   value.
3. Remove the corresponding filter / source-catalogue restriction.
4. Add the appropriate runtime affordance (e.g. for `terrain`:
   register the DEM source in `MAP_SOURCES`; call `map.setTerrain(...)`
   in `MapView.svelte`'s post-style hook).
5. Add a regression test that verifies the new behaviour is now
   active.
6. Cite this ADR as the _Supersedes / Amends_ anchor in the new ADR.

## Alternatives considered

### A. Distributed config + ADR-only documentation

Each lockdown lived at its native call site; the ADR was the only
common reference. Rejected: re-enabler must hunt across multiple
files, and there is no mechanical guard against drift between the
ADR text and the call sites.

### B. Centralised constants used as documentation only (no runtime import)

A `const LOCKDOWN_REGISTER` literal that consumers don't actually
import; consumers hard-code the same values. Rejected: same drift
hazard as full distribution since nothing prevents the constants and
the call sites from diverging.

### C. Feature flag (env var or build-time constant)

A `?debug3d=1` URL parameter or a build-time `ENABLE_3D` constant
that conditionally bypasses the lockdown. Rejected: the user's
directive ("目前版本先關閉，避免誤觸" — disable in this version,
avoid accidental triggering) treats the lockdown as the durable
invariant. An escape hatch invites the exact accidental enablement
we are guarding against.

### D. Runtime defence-in-depth — throw on disallowed layer types

Style assembly throws if a disallowed layer slips past the filter.
Rejected: would crash the app for users when a future basemap
upstream silently introduces a hillshade layer; silent stripping with
test coverage is the better trade between user resilience and
developer visibility.

## Notes

- The closed set of six capability classes is calibrated against
  the pinned MapLibre version (v3.6.2). If a future MapLibre version
  introduces a new 3D-class capability (e.g. shadow casting,
  atmospheric scattering), the lockdown register MUST be amended in
  the same release that picks up the new MapLibre version — see the
  spec's Assumptions block.
- Marker `pitchAlignment` / `rotationAlignment` defaults are out of
  scope: this app uses CSS overlays (the crosshair) rather than
  MapLibre Markers, so those defaults have no observable effect.
- Bearing rotation remains enabled. Rotation is orthogonal to the 3D
  axis; the existing compass / `bearingSignal` UX is unaffected.
