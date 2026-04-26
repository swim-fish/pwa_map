import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  DISMISSAL_WINDOW_MS,
  __INSTALL_DISMISSED_KEY,
  getDismissedUntil,
  setDismissedUntil,
} from '../../../src/storage/installDismissed';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

describe('installDismissed storage (feature 005 D4)', () => {
  test('absent key — getDismissedUntil() returns null', () => {
    expect(getDismissedUntil()).toBeNull();
  });

  test('future timestamp round-trips', () => {
    const future = Date.now() + DISMISSAL_WINDOW_MS;
    setDismissedUntil(future);
    expect(getDismissedUntil()).toBe(future);
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBe(String(future));
  });

  test('past timestamp returns null AND localStorage is unchanged', () => {
    const past = Date.now() - 1_000_000;
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(past));
    expect(getDismissedUntil()).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBe(String(past));
  });

  test.each([
    ['true'],
    ['{"x":1}'],
    [''],
    ['NaN'],
    ['Infinity'],
    ['-Infinity'],
    ['1.5'],
    ['8.64e15'],
    [' 1796428800000 '],
    ['1796428800000\n'],
  ])('corrupted value %s is treated as absent', (raw) => {
    localStorage.setItem(__INSTALL_DISMISSED_KEY, raw);
    expect(getDismissedUntil()).toBeNull();
  });

  test.each([['-1'], ['0']])('non-positive %s is rejected', (raw) => {
    localStorage.setItem(__INSTALL_DISMISSED_KEY, raw);
    expect(getDismissedUntil()).toBeNull();
  });

  test.each([[Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY], [-1], [0]])(
    'writer rejects %s without writing',
    (input) => {
      setDismissedUntil(input);
      expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBeNull();
    },
  );

  test('writer coerces fractional via Math.floor', () => {
    const future = Date.now() + DISMISSAL_WINDOW_MS;
    setDismissedUntil(future + 0.5);
    expect(getDismissedUntil()).toBe(Math.floor(future + 0.5));
  });

  test('localStorage throwing on getItem returns null gracefully', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error('SecurityError');
    });
    try {
      expect(getDismissedUntil()).toBeNull();
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  test('localStorage throwing on setItem is silent', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(() => setDismissedUntil(Date.now() + DISMISSAL_WINDOW_MS)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  test('DISMISSAL_WINDOW_MS magic constant', () => {
    expect(DISMISSAL_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test('__INSTALL_DISMISSED_KEY literal', () => {
    expect(__INSTALL_DISMISSED_KEY).toBe('pwa_map:installDismissedUntil');
  });
});
