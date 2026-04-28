import { describe, test, expect } from 'vitest';
import {
  INITIAL_SNAPSHOT,
  transition,
  type LocateMachineSnapshot,
  type LocateState,
} from '../../src/map/locateMachine';

// Feature 013 US3 — manual pan demotes Follow → Show without explicit
// gesture (FR-018). The demotion is dispatched into the locate machine
// via `applyLocateEvent({ type: 'manualPan' })` from App.svelte's
// `dragstart` listener (registered on the underlying MapLibre map in
// `onMount`). The listener filters by `originalEvent` truthiness and
// `controller.isRecenteringForLocate` falsiness.
//
// This spec verifies the machine's transition surface for manualPan:
// the App-level wiring is exercised by the e2e suite.

function snap(state: LocateState): LocateMachineSnapshot {
  return Object.freeze({
    state,
    permission: 'granted' as const,
    lastFix: null,
  });
}

describe('locateMachine — manualPan transition', () => {
  test('manualPan from Follow → Show (FR-018)', () => {
    expect(transition(snap('follow'), { type: 'manualPan' }).state).toBe('show');
  });

  test('manualPan from Show → Show (free pan, no demote)', () => {
    expect(transition(snap('show'), { type: 'manualPan' }).state).toBe('show');
  });

  test('manualPan from Off → Off', () => {
    expect(transition(snap('off'), { type: 'manualPan' }).state).toBe('off');
  });
});

describe('locateMachine — manualPan does not change permission or lastFix', () => {
  test('permission preserved across demote', () => {
    const start = Object.freeze({
      state: 'follow' as LocateState,
      permission: 'granted' as const,
      lastFix: { lat: 25, lon: 121, accuracy: 10, timestamp: 1 },
    });
    const next = transition(start, { type: 'manualPan' });
    expect(next.state).toBe('show');
    expect(next.permission).toBe('granted');
    expect(next.lastFix).toEqual({ lat: 25, lon: 121, accuracy: 10, timestamp: 1 });
  });
});

describe('initial-state guard', () => {
  test('INITIAL_SNAPSHOT.state is off', () => {
    expect(INITIAL_SNAPSHOT.state).toBe('off');
  });
});
