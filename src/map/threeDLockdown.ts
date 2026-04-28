/**
 * Feature 012 — 3D / Terrain lockdown register.
 *
 * Single source of truth for every MapLibre 3D / Terrain capability the
 * app deliberately keeps off in this version. Three call sites consume
 * this register at construction / assembly time:
 *
 *   1. `src/components/MapView.svelte` — reads `pitch` and `globe`
 *      to set the MapLibre construction options (`maxPitch`,
 *      `projection`).
 *   2. `src/map/styleBuilder.ts` — reads `sky`, `fillExtrusion`, and
 *      `hillshade` to strip disallowed entries from the assembled
 *      style at every rebuild.
 *   3. `src/map/sources.ts` — JSDoc-only cross-reference (no runtime
 *      use); forbids the registration of a terrain RGB DEM source
 *      while `terrain.lockedValue === null`.
 *
 * Re-enabling 3D in a future feature is a deliberate code change:
 * flip the `lockedValue` here, then remove the corresponding filter
 * call site (per each entry's `reEnableHint`).
 *
 * No runtime escape hatch (FR-001b): the module reads no env vars,
 * no build-time env constants, no browser storage, no URL query
 * parameters. Re-enable is always a deliberate code edit.
 *
 * Authoritative spec / contract:
 *   - specs/012-settings-about-and-mobile-fixes/spec.md FR-001..FR-009
 *   - specs/012-settings-about-and-mobile-fixes/contracts/three-d-lockdown-register.md
 *   - docs/adr/0032-three-d-lockdown-register.md
 */

export type LockdownClass = 'pitch' | 'sky' | 'globe' | 'terrain' | 'fillExtrusion' | 'hillshade';

export interface LockdownEntry<TLocked> {
  readonly class: LockdownClass;
  readonly lockedValue: TLocked;
  readonly reEnableHint: string;
}

export interface LockdownRegister {
  readonly pitch: LockdownEntry<0>;
  readonly sky: LockdownEntry<false>;
  readonly globe: LockdownEntry<'mercator'>;
  readonly terrain: LockdownEntry<null>;
  readonly fillExtrusion: LockdownEntry<false>;
  readonly hillshade: LockdownEntry<false>;
}

export const LOCKDOWN_REGISTER: LockdownRegister = Object.freeze({
  pitch: Object.freeze({
    class: 'pitch' as const,
    lockedValue: 0 as const,
    reEnableHint:
      'Raise lockedValue (e.g. 60); MapView reads it as the maxPitch construction option.',
  }),
  sky: Object.freeze({
    class: 'sky' as const,
    lockedValue: false as const,
    reEnableHint:
      'Flip to true and remove the styleBuilder applyLockdown sky-strip; add a sky block to a basemap.',
  }),
  globe: Object.freeze({
    class: 'globe' as const,
    lockedValue: 'mercator' as const,
    reEnableHint:
      'Change to "globe"; MapView passes the value as the projection construction option.',
  }),
  terrain: Object.freeze({
    class: 'terrain' as const,
    lockedValue: null,
    reEnableHint:
      'Add a terrain RGB DEM source and call map.setTerrain({ source, exaggeration }) in MapView.',
  }),
  fillExtrusion: Object.freeze({
    class: 'fillExtrusion' as const,
    lockedValue: false as const,
    reEnableHint:
      'Flip to true and remove the styleBuilder fill-extrusion filter; add a vector source.',
  }),
  hillshade: Object.freeze({
    class: 'hillshade' as const,
    lockedValue: false as const,
    reEnableHint:
      'Flip to true and remove the styleBuilder hillshade filter; needs a terrain RGB source.',
  }),
});
