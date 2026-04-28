/**
 * Pure state-machine module for the my-location feature (013).
 *
 * No DOM, no clock, no map, no geolocation API import.
 * Consumers: locateSignal.ts (the Svelte store), LocateButton.svelte
 * (gesture handlers), geolocationController.ts (lifecycle).
 */

export type LocateState = 'off' | 'show' | 'follow';

export type LocateFrequencyPreset = 'smart' | 'fast' | 'slow';

export type LocatePermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

export interface PositionFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number;
  readonly timestamp: number;
}

export type LocateEvent =
  | { type: 'shortTap' }
  | { type: 'longPress' }
  | { type: 'manualPan' }
  | { type: 'permissionDenied' }
  | { type: 'permissionUnavailable' }
  | { type: 'firstFix'; fix: PositionFix };

export interface LocateMachineSnapshot {
  readonly state: LocateState;
  readonly permission: LocatePermissionState;
  readonly lastFix: PositionFix | null;
  readonly pressStartedAt: number | null;
}

export const INITIAL_SNAPSHOT: LocateMachineSnapshot = Object.freeze({
  state: 'off' as LocateState,
  permission: 'prompt' as LocatePermissionState,
  lastFix: null,
  pressStartedAt: null,
});

function freeze(snapshot: LocateMachineSnapshot): LocateMachineSnapshot {
  return Object.freeze({ ...snapshot });
}

export function transition(
  snapshot: LocateMachineSnapshot,
  event: LocateEvent,
): LocateMachineSnapshot {
  switch (event.type) {
    case 'shortTap': {
      // Permission gate: shortTap is a no-op when permission is denied / unavailable.
      if (snapshot.permission === 'denied' || snapshot.permission === 'unavailable') {
        return snapshot;
      }
      let nextState: LocateState;
      switch (snapshot.state) {
        case 'off':
          nextState = 'show';
          break;
        case 'show':
          nextState = 'follow';
          break;
        case 'follow':
          nextState = 'show';
          break;
      }
      return freeze({ ...snapshot, state: nextState });
    }
    case 'longPress': {
      // From off, longPress is a no-op (FR-014g).
      if (snapshot.state === 'off') return snapshot;
      return freeze({ ...snapshot, state: 'off' });
    }
    case 'manualPan': {
      // Only Follow demotes; Off and Show are unchanged.
      if (snapshot.state !== 'follow') return snapshot;
      return freeze({ ...snapshot, state: 'show' });
    }
    case 'permissionDenied': {
      return freeze({ ...snapshot, state: 'off', permission: 'denied' });
    }
    case 'permissionUnavailable': {
      return freeze({ ...snapshot, state: 'off', permission: 'unavailable' });
    }
    case 'firstFix': {
      return freeze({ ...snapshot, lastFix: event.fix });
    }
  }
}
