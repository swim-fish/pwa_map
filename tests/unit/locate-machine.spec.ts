import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INITIAL_SNAPSHOT,
  transition,
  type LocateEvent,
  type LocateMachineSnapshot,
  type LocateState,
  type LocatePermissionState,
} from '$map/locateMachine';

// Feature 013 — pure state-machine module (T008 / contracts/locate-machine.md).
// All assertions are referentially transparent: no DOM, no clock, no map.

const REPO = process.cwd();
const SOURCE = resolve(REPO, 'src/map/locateMachine.ts');

function snap(
  state: LocateState,
  permission: LocatePermissionState = 'granted',
): LocateMachineSnapshot {
  return Object.freeze({
    state,
    permission,
    lastFix: null,
  });
}

describe('locateMachine — INITIAL_SNAPSHOT shape', () => {
  test('initial state is off, permission prompt, lastFix null', () => {
    expect(INITIAL_SNAPSHOT.state).toBe<LocateState>('off');
    expect(INITIAL_SNAPSHOT.permission).toBe<LocatePermissionState>('prompt');
    expect(INITIAL_SNAPSHOT.lastFix).toBeNull();
  });

  test('INITIAL_SNAPSHOT is frozen', () => {
    expect(Object.isFrozen(INITIAL_SNAPSHOT)).toBe(true);
  });
});

describe('locateMachine — transition table (granted permission)', () => {
  // shortTap row
  test('shortTap from off → show', () => {
    expect(transition(snap('off'), { type: 'shortTap' }).state).toBe('show');
  });
  test('shortTap from show → follow', () => {
    expect(transition(snap('show'), { type: 'shortTap' }).state).toBe('follow');
  });
  test('shortTap from follow → show', () => {
    expect(transition(snap('follow'), { type: 'shortTap' }).state).toBe('show');
  });

  // longPress row
  test('longPress from off → off (no-op, FR-014g)', () => {
    expect(transition(snap('off'), { type: 'longPress' }).state).toBe('off');
  });
  test('longPress from show → off', () => {
    expect(transition(snap('show'), { type: 'longPress' }).state).toBe('off');
  });
  test('longPress from follow → off', () => {
    expect(transition(snap('follow'), { type: 'longPress' }).state).toBe('off');
  });

  // manualPan row
  test('manualPan from off → off', () => {
    expect(transition(snap('off'), { type: 'manualPan' }).state).toBe('off');
  });
  test('manualPan from show → show (free pan, no demote)', () => {
    expect(transition(snap('show'), { type: 'manualPan' }).state).toBe('show');
  });
  test('manualPan from follow → show (auto-demote, FR-018)', () => {
    expect(transition(snap('follow'), { type: 'manualPan' }).state).toBe('show');
  });

  // permissionDenied row
  test('permissionDenied from any state → off; permission ← denied', () => {
    for (const s of ['off', 'show', 'follow'] as const) {
      const next = transition(snap(s), { type: 'permissionDenied' });
      expect(next.state).toBe('off');
      expect(next.permission).toBe('denied');
    }
  });

  // permissionUnavailable row
  test('permissionUnavailable from any state → off; permission ← unavailable', () => {
    for (const s of ['off', 'show', 'follow'] as const) {
      const next = transition(snap(s), { type: 'permissionUnavailable' });
      expect(next.state).toBe('off');
      expect(next.permission).toBe('unavailable');
    }
  });
});

describe('locateMachine — shortTap is no-op when permission ∈ {denied, unavailable}', () => {
  test('shortTap from off + denied → off', () => {
    expect(transition(snap('off', 'denied'), { type: 'shortTap' }).state).toBe('off');
  });
  test('shortTap from off + unavailable → off', () => {
    expect(transition(snap('off', 'unavailable'), { type: 'shortTap' }).state).toBe('off');
  });
});

describe('locateMachine — firstFix updates lastFix without changing state', () => {
  const fix = { lat: 25.04, lon: 121.51, accuracy: 12, timestamp: 1714000000000 };

  test('firstFix at off → state stays off, lastFix updates', () => {
    const next = transition(snap('off'), { type: 'firstFix', fix });
    expect(next.state).toBe('off');
    expect(next.lastFix).toEqual(fix);
  });
  test('firstFix at show → state stays show, lastFix updates', () => {
    const next = transition(snap('show'), { type: 'firstFix', fix });
    expect(next.state).toBe('show');
    expect(next.lastFix).toEqual(fix);
  });
  test('firstFix at follow → state stays follow, lastFix updates', () => {
    const next = transition(snap('follow'), { type: 'firstFix', fix });
    expect(next.state).toBe('follow');
    expect(next.lastFix).toEqual(fix);
  });
});

describe('locateMachine — outputs are frozen', () => {
  test.each<LocateEvent>([
    { type: 'shortTap' },
    { type: 'longPress' },
    { type: 'manualPan' },
    { type: 'permissionDenied' },
    { type: 'permissionUnavailable' },
    { type: 'firstFix', fix: { lat: 0, lon: 0, accuracy: 1, timestamp: 0 } },
  ])('transition output is frozen for event %s', (event) => {
    const out = transition(INITIAL_SNAPSHOT, event);
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe('locateMachine — pure (no side effects)', () => {
  test('does not call Date.now / setTimeout / window / document / navigator / localStorage', () => {
    const dateNow = Date.now;
    const setTimeoutFn = globalThis.setTimeout;
    const calls: string[] = [];
    Date.now = () => {
      calls.push('Date.now');
      return 0;
    };
    globalThis.setTimeout = ((..._args: unknown[]) => {
      calls.push('setTimeout');
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    try {
      transition(INITIAL_SNAPSHOT, { type: 'shortTap' });
      transition(snap('show'), { type: 'longPress' });
      transition(snap('follow'), { type: 'manualPan' });
    } finally {
      Date.now = dateNow;
      globalThis.setTimeout = setTimeoutFn;
    }
    expect(calls).toEqual([]);
  });
});

describe('locateMachine — forbidden imports (grep guard)', () => {
  const src = readFileSync(SOURCE, 'utf8');

  test('no import of $components/*', () => {
    expect(src).not.toMatch(/from\s+['"]\$components\//);
  });
  test('no import of $pwa/*', () => {
    expect(src).not.toMatch(/from\s+['"]\$pwa\//);
  });
  test('no import of $map/MapController', () => {
    expect(src).not.toMatch(/from\s+['"]\$map\/MapController['"]/);
  });
  test('no import of $map/geolocationController', () => {
    expect(src).not.toMatch(/from\s+['"]\$map\/geolocationController['"]/);
  });
  test('no import of $map/locateSignal', () => {
    expect(src).not.toMatch(/from\s+['"]\$map\/locateSignal['"]/);
  });
  test('no reference to window / document / navigator / localStorage', () => {
    expect(src).not.toMatch(/\b(window|document|navigator|localStorage)\b/);
  });
  test('no reference to Date.now() / performance.now() / setTimeout / setInterval', () => {
    expect(src).not.toMatch(/\b(Date\.now|performance\.now|setTimeout|setInterval)\b/);
  });
});
