import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LOCKDOWN_REGISTER,
  type LockdownClass,
  type LockdownEntry,
  type LockdownRegister,
} from '../../src/map/threeDLockdown';

// Feature 012 — three-d-lockdown register contract / shape spec.
// See specs/012-settings-about-and-mobile-fixes/contracts/three-d-lockdown-register.md.

const MODULE = resolve(process.cwd(), 'src/map/threeDLockdown.ts');

describe('threeDLockdown — registry shape (feature 012 / FR-001)', () => {
  test('I1 — register and every entry is Object.freeze`d', () => {
    expect(Object.isFrozen(LOCKDOWN_REGISTER)).toBe(true);
    const keys = Object.keys(LOCKDOWN_REGISTER) as LockdownClass[];
    for (const k of keys) {
      const entry = LOCKDOWN_REGISTER[k] as LockdownEntry<unknown>;
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  test('I2 — closed key set: exactly six classes', () => {
    expect(Object.keys(LOCKDOWN_REGISTER).sort()).toEqual([
      'fillExtrusion',
      'globe',
      'hillshade',
      'pitch',
      'sky',
      'terrain',
    ]);
  });

  test('§2 — pitch.lockedValue === 0', () => {
    expect(LOCKDOWN_REGISTER.pitch.lockedValue).toBe(0);
    expect(LOCKDOWN_REGISTER.pitch.class).toBe('pitch');
  });

  test('§2 — sky.lockedValue === false', () => {
    expect(LOCKDOWN_REGISTER.sky.lockedValue).toBe(false);
    expect(LOCKDOWN_REGISTER.sky.class).toBe('sky');
  });

  test("§2 — globe.lockedValue === 'mercator'", () => {
    expect(LOCKDOWN_REGISTER.globe.lockedValue).toBe('mercator');
    expect(LOCKDOWN_REGISTER.globe.class).toBe('globe');
  });

  test('§2 — terrain.lockedValue === null', () => {
    expect(LOCKDOWN_REGISTER.terrain.lockedValue).toBe(null);
    expect(LOCKDOWN_REGISTER.terrain.class).toBe('terrain');
  });

  test('§2 — fillExtrusion.lockedValue === false', () => {
    expect(LOCKDOWN_REGISTER.fillExtrusion.lockedValue).toBe(false);
    expect(LOCKDOWN_REGISTER.fillExtrusion.class).toBe('fillExtrusion');
  });

  test('§2 — hillshade.lockedValue === false', () => {
    expect(LOCKDOWN_REGISTER.hillshade.lockedValue).toBe(false);
    expect(LOCKDOWN_REGISTER.hillshade.class).toBe('hillshade');
  });

  test('I3 — every entry has a non-empty re-enable hint ≤ 140 chars', () => {
    const keys = Object.keys(LOCKDOWN_REGISTER) as LockdownClass[];
    for (const k of keys) {
      const entry = LOCKDOWN_REGISTER[k] as LockdownEntry<unknown>;
      expect(entry.reEnableHint).toMatch(/\S/);
      expect(entry.reEnableHint.length).toBeLessThanOrEqual(140);
    }
  });

  test('I4 — module source has no runtime escape-hatch references', () => {
    const src = readFileSync(MODULE, 'utf8');
    // No env-derived configuration. Re-enabling 3D is always a deliberate
    // code change per FR-001b.
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/import\.meta\.env/);
    expect(src).not.toMatch(/localStorage/);
    expect(src).not.toMatch(/URLSearchParams/);
    expect(src).not.toMatch(/window\.location/);
  });

  test('I5 — module shape: only the documented exports', () => {
    // The module must export exactly the documented public surface.
    // Any new symbol indicates accidental scope creep.
    const src = readFileSync(MODULE, 'utf8');
    const exportLines = src.split('\n').filter((l) => /^export\s/.test(l.trim()));
    // Allow type re-exports + the const. Test asserts the count is small
    // and includes the LOCKDOWN_REGISTER const.
    expect(src).toMatch(/export\s+const\s+LOCKDOWN_REGISTER/);
    expect(src).toMatch(/export\s+type\s+LockdownClass/);
    expect(src).toMatch(/export\s+interface\s+LockdownEntry/);
    expect(src).toMatch(/export\s+interface\s+LockdownRegister/);
    // Sanity: we don't export a runtime helper for unfreezing.
    expect(exportLines.join('\n')).not.toMatch(/unfreeze|enable|disable/i);
  });

  test('TS literal types satisfied — LockdownRegister assignability', () => {
    // Compile-time: this assignment is only valid if the literal types
    // in LockdownRegister narrow as documented in §2.
    const r: LockdownRegister = LOCKDOWN_REGISTER;
    expect(r.pitch.lockedValue satisfies 0).toBe(0);
    expect(r.sky.lockedValue satisfies false).toBe(false);
    expect(r.globe.lockedValue satisfies 'mercator').toBe('mercator');
    expect(r.terrain.lockedValue satisfies null).toBe(null);
    expect(r.fillExtrusion.lockedValue satisfies false).toBe(false);
    expect(r.hillshade.lockedValue satisfies false).toBe(false);
  });
});
