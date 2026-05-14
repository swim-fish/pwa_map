import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeolocationController } from '$map/geolocationController';

// Feature 014 — Smart promote-on-movement burst.
// Restores the deferred branch from feature 013 (Addendum A2): when the
// Smart preset's watcher delivers two consecutive position pairs whose
// haversine speed ≥ 1 m/s, the controller starts a second concurrent
// watchPosition subscription with Fast options for 5 s, then tears it down.
//
// Contract: specs/014-smart-promote-cadence/contracts/geolocation-controller-burst.md

interface WatchCall {
  success: PositionCallback;
  error: PositionErrorCallback | null;
  options: PositionOptions | undefined;
  watchId: number;
  cleared: boolean;
}

interface MockGeolocation {
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
  calls: WatchCall[];
  // Deliver a fix to the most recently registered (still-active) success callback.
  deliverLatest: (lat: number, lon: number, accuracy: number, timestamp: number) => void;
  // Deliver a fix to a specific watch index.
  deliverTo: (index: number, lat: number, lon: number, accuracy: number, timestamp: number) => void;
}

function makeMockGeolocation(): MockGeolocation {
  const calls: WatchCall[] = [];
  let nextWatchId = 1;
  const watchPosition = vi.fn(
    (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ): number => {
      const watchId = nextWatchId++;
      calls.push({ success, error: error ?? null, options, watchId, cleared: false });
      return watchId;
    },
  );
  const clearWatch = vi.fn((watchId: number) => {
    const call = calls.find((c) => c.watchId === watchId);
    if (call) call.cleared = true;
  });

  const dispatchTo = (call: WatchCall, lat: number, lon: number, accuracy: number, ts: number) => {
    if (call.cleared) return;
    call.success({
      coords: {
        latitude: lat,
        longitude: lon,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      } as GeolocationCoordinates,
      timestamp: ts,
      toJSON: () => ({}),
    } as unknown as GeolocationPosition);
  };

  return {
    watchPosition,
    clearWatch,
    calls,
    deliverLatest: (lat, lon, acc, ts) => {
      for (let i = calls.length - 1; i >= 0; i--) {
        if (!calls[i].cleared) {
          dispatchTo(calls[i], lat, lon, acc, ts);
          return;
        }
      }
    },
    deliverTo: (index, lat, lon, acc, ts) => {
      const call = calls[index];
      if (call) dispatchTo(call, lat, lon, acc, ts);
    },
  };
}

// Geometry helpers for fixture construction.
// At lat ≈ 25°, 1° of latitude ≈ 111 132 m, so 0.0001° ≈ 11.1 m.
// We use lat-only displacements to keep distance computations stable
// against the implementation's haversine (which we treat as a black box).
const STATIONARY_LAT = 25.0;
const STATIONARY_LON = 121.0;
const MOVING_LAT_STEP = 0.0001; // ≈ 11.1 m north — comfortably > 1 m/s over 5 s
const STATIONARY_LAT_JITTER = 0.00000045; // ≈ 5 cm jitter — well under threshold

describe('GeolocationController — Smart promote-on-movement burst (014)', () => {
  let mock: MockGeolocation;
  let originalGeolocation: typeof navigator.geolocation;
  let onFix: ReturnType<typeof vi.fn>;
  let onPositionUnavailable: ReturnType<typeof vi.fn>;
  let controller: GeolocationController;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    mock = makeMockGeolocation();
    originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: mock as unknown as Geolocation,
    });
    onFix = vi.fn();
    onPositionUnavailable = vi.fn();
    controller = new GeolocationController({
      onFix,
      onPermissionDenied: vi.fn(),
      onPositionUnavailable,
      onTimeout: vi.fn(),
    });
  });

  afterEach(() => {
    controller.dispose();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
    vi.useRealTimers();
  });

  test('first fix does not start a burst (FR-011)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenCalledTimes(1);
  });

  test('single moving pair does not start a burst (R1 guard — needs TWO consecutive moving pairs)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
  });

  test('two consecutive moving pairs start a burst with Fast options (FR-001, FR-002, FR-004)', () => {
    controller.start('smart');
    // fix 1: baseline
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    // fix 2: moving (pair 1 over 5 s, ≈ 2.2 m/s)
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    // fix 3: still moving (pair 2 over 5 s)
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(2);
    expect(mock.calls[1].options).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });

  test('motion below 1 m/s does not start a burst (FR-004)', () => {
    controller.start('smart');
    // 0.0000045° lat over 5 s ≈ 0.5 m / 5 s = 0.1 m/s — well below threshold
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + 0.0000045, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 0.000009, STATIONARY_LON, 10, 1_010_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
  });

  test('burst tears down after 5 000 ms (FR-003)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    const burstWatchId = mock.calls[1].watchId;
    expect(mock.clearWatch).not.toHaveBeenCalledWith(burstWatchId);
    vi.advanceTimersByTime(4_999);
    expect(mock.clearWatch).not.toHaveBeenCalledWith(burstWatchId);
    vi.advanceTimersByTime(1);
    expect(mock.clearWatch).toHaveBeenCalledWith(burstWatchId);
  });

  test('only one burst is in flight at a time (FR-006)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(2);
    // Feed a fourth fix that would otherwise satisfy the moving-pair rule
    // (the controller's `previousFixWasMoving` flag is still true after
    // the third fix). The burst is already in flight, so no second burst
    // should be spawned.
    mock.deliverLatest(STATIONARY_LAT + 3 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_015_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(2);
  });

  test('Fast preset does not promote (FR-005)', () => {
    controller.start('fast');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
  });

  test('Slow preset does not promote (FR-005)', () => {
    controller.start('slow');
    // Slow's 10 s min-dispatch throttle will drop some fixes, but
    // promote should not fire on the dispatched ones either.
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_015_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_030_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
  });

  test('stop() tears down both base and burst subscriptions (FR-007)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    const baseWatchId = mock.calls[0].watchId;
    const burstWatchId = mock.calls[1].watchId;
    controller.stop();
    expect(mock.clearWatch).toHaveBeenCalledWith(baseWatchId);
    expect(mock.clearWatch).toHaveBeenCalledWith(burstWatchId);
  });

  test('dispose() tears down both base and burst subscriptions (FR-007)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    const baseWatchId = mock.calls[0].watchId;
    const burstWatchId = mock.calls[1].watchId;
    controller.dispose();
    expect(mock.clearWatch).toHaveBeenCalledWith(baseWatchId);
    expect(mock.clearWatch).toHaveBeenCalledWith(burstWatchId);
  });

  test('preset switch resets movement baseline (PR#7 Codex P2)', () => {
    // Without resetting `previousFix` on start(), a smart → fast → smart
    // toggle leaks the prior baseline. The next Smart fix would compare
    // against a stale coordinate, so the SECOND Smart fix could trigger
    // a burst after only one in-session moving pair — violating the
    // "two consecutive moving pairs" guard (research §R1) and the
    // "first fix is baseline" contract (geolocationController.ts:201).
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    // One moving pair so far on Smart — no burst yet.
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);

    // Toggle Smart → Fast → Smart while the user keeps moving north.
    controller.start('fast');
    controller.start('smart');
    expect(mock.watchPosition).toHaveBeenCalledTimes(3); // 1 smart + 1 fast + 1 smart

    // After re-entering Smart, the next fix MUST be a fresh baseline.
    // Two further moving fixes form a single moving pair from that
    // baseline — that alone must not start a burst. The burst would
    // only be allowed on a THIRD moving fix (two consecutive moving
    // pairs from the fresh baseline).
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    mock.deliverLatest(STATIONARY_LAT + 3 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_015_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(3);

    // A third moving fix from the fresh baseline does start a burst,
    // confirming the rule still works after the toggle.
    mock.deliverLatest(STATIONARY_LAT + 4 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_020_000);
    expect(mock.watchPosition).toHaveBeenCalledTimes(4);
    expect(mock.calls[3].options).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });

  test('preset switch tears down burst before re-subscribing base (FR-008)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    const baseWatchId = mock.calls[0].watchId;
    const burstWatchId = mock.calls[1].watchId;
    controller.start('fast');
    expect(mock.clearWatch).toHaveBeenCalledWith(baseWatchId);
    expect(mock.clearWatch).toHaveBeenCalledWith(burstWatchId);
    // A new base subscription is started with Fast options.
    expect(mock.watchPosition).toHaveBeenCalledTimes(3);
    expect(mock.calls[2].options).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });

  test('burst start that throws is silently aborted (FR-009)', () => {
    let callCount = 0;
    const throwingMock = {
      watchPosition: vi.fn(
        (success: PositionCallback, error?: PositionErrorCallback | null): number => {
          callCount++;
          if (callCount === 1) {
            mock.watchPosition(success, error ?? null);
            return mock.calls[0].watchId;
          }
          throw new Error('second watcher disallowed by policy');
        },
      ),
      clearWatch: mock.clearWatch,
    } as unknown as Geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: throwingMock,
    });
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    expect(() => {
      mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    }).not.toThrow();
    expect(onPositionUnavailable).not.toHaveBeenCalled();
    // Base subscription is still healthy: a fourth fix should still flow through.
    mock.deliverLatest(STATIONARY_LAT + 3 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_015_000);
    expect(onFix).toHaveBeenCalledTimes(4);
  });

  test('burst fixes flow through options.onFix (FR-010)', () => {
    controller.start('smart');
    mock.deliverLatest(STATIONARY_LAT, STATIONARY_LON, 10, 1_000_000);
    mock.deliverLatest(STATIONARY_LAT + MOVING_LAT_STEP, STATIONARY_LON, 10, 1_005_000);
    mock.deliverLatest(STATIONARY_LAT + 2 * MOVING_LAT_STEP, STATIONARY_LON, 10, 1_010_000);
    expect(onFix).toHaveBeenCalledTimes(3);
    // A fix delivered via the burst subscription (index 1) should also flow through onFix.
    mock.deliverTo(1, STATIONARY_LAT + 3 * MOVING_LAT_STEP, STATIONARY_LON, 8, 1_010_500);
    expect(onFix).toHaveBeenCalledTimes(4);
    expect(onFix.mock.calls[3][0]).toMatchObject({ accuracy: 8, timestamp: 1_010_500 });
  });

  test('10 stationary fixes do not trigger a burst (SC-004)', () => {
    controller.start('smart');
    for (let i = 0; i < 10; i++) {
      mock.deliverLatest(
        STATIONARY_LAT + i * STATIONARY_LAT_JITTER,
        STATIONARY_LON,
        10,
        1_000_000 + i * 5_000,
      );
    }
    expect(mock.watchPosition).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenCalledTimes(10);
  });
});
