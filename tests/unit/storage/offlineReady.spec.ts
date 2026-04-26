import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  hasShownOfflineReady,
  markOfflineReadyShown,
  __OFFLINE_READY_KEY,
} from '../../../src/storage/offlineReady';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

describe('offlineReady storage flag (feature 004 SC-008)', () => {
  test('absent key — hasShownOfflineReady() returns false', () => {
    expect(hasShownOfflineReady()).toBe(false);
  });

  test('markOfflineReadyShown() then hasShownOfflineReady() returns true', () => {
    markOfflineReadyShown();
    expect(hasShownOfflineReady()).toBe(true);
    expect(localStorage.getItem(__OFFLINE_READY_KEY)).toBe('1');
  });

  test("corrupted value 'true' is treated as absent (self-heals)", () => {
    localStorage.setItem(__OFFLINE_READY_KEY, 'true');
    expect(hasShownOfflineReady()).toBe(false);
  });

  test('corrupted JSON value is treated as absent (self-heals)', () => {
    localStorage.setItem(__OFFLINE_READY_KEY, JSON.stringify({ shown: true }));
    expect(hasShownOfflineReady()).toBe(false);
  });

  test('empty string value is treated as absent', () => {
    localStorage.setItem(__OFFLINE_READY_KEY, '');
    expect(hasShownOfflineReady()).toBe(false);
  });

  test('localStorage throwing on getItem returns false gracefully', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error('SecurityError');
    });
    try {
      expect(hasShownOfflineReady()).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  test('localStorage throwing on setItem in markOfflineReadyShown is silent', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(() => markOfflineReadyShown()).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  test('uses key pwa_map:offlineReadyShown', () => {
    expect(__OFFLINE_READY_KEY).toBe('pwa_map:offlineReadyShown');
  });
});
