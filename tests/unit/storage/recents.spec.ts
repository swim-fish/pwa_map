import { describe, test, expect, beforeEach } from 'vitest';
import {
  loadRecents,
  saveRecents,
  addRecent,
  removeRecent,
  RECENTS_KEY,
  MAX_RECENTS,
} from '../../../src/storage/recents';
import type { FormatSelection, RecentList } from '../../../src/types/goto';

const AUTO: FormatSelection = { kind: 'auto' };
const DD: FormatSelection = { kind: 'fixed', value: 'wgs84-dd' };
const MGRS: FormatSelection = { kind: 'fixed', value: 'mgrs' };

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

describe('recents storage — load path', () => {
  test('empty load returns { version: 1, entries: [] }', () => {
    expect(loadRecents()).toEqual({ version: 1, entries: [] });
  });

  test('round-trip — saveRecents then loadRecents returns the same list', () => {
    const list: RecentList = {
      version: 1,
      entries: [{ format: AUTO, raw: '25.0, 121.5', createdAt: 100 }],
    };
    saveRecents(list);
    const loaded = loadRecents();
    expect(loaded.version).toBe(1);
    expect(loaded.entries.length).toBe(1);
    expect(loaded.entries[0]).toEqual({ format: AUTO, raw: '25.0, 121.5', createdAt: 100 });
  });

  test('version mismatch (2) → empty list', () => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify({ version: 2, entries: [] }));
    expect(loadRecents()).toEqual({ version: 1, entries: [] });
  });

  test('corrupt JSON → empty list, no throw', () => {
    localStorage.setItem(RECENTS_KEY, 'not-json');
    expect(loadRecents()).toEqual({ version: 1, entries: [] });
  });

  test('bad entry shape → entire list discarded', () => {
    localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify({
        version: 1,
        entries: [{ format: AUTO, createdAt: 100 }], // missing `raw`
      }),
    );
    expect(loadRecents()).toEqual({ version: 1, entries: [] });
  });

  test('truncates load to MAX_RECENTS', () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => ({
      format: AUTO,
      raw: `entry-${i}`,
      createdAt: i,
    }));
    localStorage.setItem(RECENTS_KEY, JSON.stringify({ version: 1, entries: tooMany }));
    const loaded = loadRecents();
    expect(loaded.entries.length).toBe(MAX_RECENTS);
  });
});

describe('addRecent', () => {
  test('happy path — add to empty list', () => {
    const list = addRecent({ version: 1, entries: [] }, AUTO, '25.0, 121.5', 100);
    expect(list.entries.length).toBe(1);
    expect(list.entries[0].raw).toBe('25.0, 121.5');
    expect(list.entries[0].createdAt).toBe(100);
  });

  test('LRU — adding an existing (format, raw) moves it to head', () => {
    let list: RecentList = { version: 1, entries: [] };
    list = addRecent(list, AUTO, 'a', 100);
    list = addRecent(list, AUTO, 'b', 200);
    list = addRecent(list, AUTO, 'a', 300);
    expect(list.entries.length).toBe(2);
    expect(list.entries[0].raw).toBe('a');
    expect(list.entries[0].createdAt).toBe(300);
    expect(list.entries[1].raw).toBe('b');
  });

  test('FIFO eviction — adding to a full list keeps length at MAX_RECENTS', () => {
    let list: RecentList = { version: 1, entries: [] };
    for (let i = 0; i < MAX_RECENTS; i++) {
      list = addRecent(list, AUTO, `e${i}`, i);
    }
    expect(list.entries.length).toBe(MAX_RECENTS);
    list = addRecent(list, AUTO, 'new', 999);
    expect(list.entries.length).toBe(MAX_RECENTS);
    expect(list.entries[0].raw).toBe('new');
    expect(list.entries.find((e) => e.raw === 'e0')).toBeUndefined();
  });

  test('distinct identity — same raw with different format produces two entries', () => {
    let list: RecentList = { version: 1, entries: [] };
    list = addRecent(list, AUTO, '25.0, 121.5', 100);
    list = addRecent(list, DD, '25.0, 121.5', 200);
    expect(list.entries.length).toBe(2);
  });

  test('distinct identity — different fixed kinds with same raw produce two entries', () => {
    let list: RecentList = { version: 1, entries: [] };
    list = addRecent(list, DD, 'X', 100);
    list = addRecent(list, MGRS, 'X', 200);
    expect(list.entries.length).toBe(2);
  });
});

describe('removeRecent', () => {
  test('removes an exact match', () => {
    let list: RecentList = { version: 1, entries: [] };
    list = addRecent(list, AUTO, 'a', 100);
    list = addRecent(list, AUTO, 'b', 200);
    list = removeRecent(list, AUTO, 'a');
    expect(list.entries.length).toBe(1);
    expect(list.entries[0].raw).toBe('b');
  });

  test('no match → no-op', () => {
    let list: RecentList = { version: 1, entries: [] };
    list = addRecent(list, AUTO, 'a', 100);
    const after = removeRecent(list, AUTO, 'z');
    expect(after.entries.length).toBe(1);
  });
});

describe('persistence size sanity', () => {
  test('a full list of 10 entries serialises to under 2 KB', () => {
    let list: RecentList = { version: 1, entries: [] };
    for (let i = 0; i < MAX_RECENTS; i++) {
      list = addRecent(list, AUTO, `entry-${i}-25.033611, 121.564472`, i);
    }
    saveRecents(list);
    const persisted = localStorage.getItem(RECENTS_KEY);
    expect(persisted).not.toBeNull();
    expect(persisted!.length).toBeLessThan(2048);
  });
});
