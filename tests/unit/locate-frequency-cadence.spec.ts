import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { frequencyToWatchOptions, GeolocationController } from '$map/geolocationController';

// Feature 013 — preset → PositionOptions mapping + Slow throttle + Smart promote
// (contracts/geolocation-controller.md, research §R1).

describe('frequencyToWatchOptions', () => {
  test('"smart" → enableHighAccuracy false, maximumAge 5000, timeout 30000', () => {
    expect(frequencyToWatchOptions('smart')).toEqual({
      enableHighAccuracy: false,
      maximumAge: 5_000,
      timeout: 30_000,
    });
  });

  test('"fast" → enableHighAccuracy true, maximumAge 0, timeout 10000', () => {
    expect(frequencyToWatchOptions('fast')).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });

  test('"slow" → enableHighAccuracy false, maximumAge 30000, timeout 60000', () => {
    expect(frequencyToWatchOptions('slow')).toEqual({
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 60_000,
    });
  });
});

interface MockGeolocation {
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
  // Deliver a fix to the most recently registered success callback.
  deliver: (lat: number, lon: number, accuracy: number, timestamp: number) => void;
  // Deliver an error to the most recently registered error callback.
  fail: (code: 1 | 2 | 3) => void;
}

function makeMockGeolocation(): MockGeolocation {
  let lastSuccess: PositionCallback | null = null;
  let lastError: PositionErrorCallback | null = null;
  let nextWatchId = 1;
  const watchPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback | null): number => {
      lastSuccess = success;
      lastError = error ?? null;
      return nextWatchId++;
    },
  );
  const clearWatch = vi.fn(() => {
    lastSuccess = null;
    lastError = null;
  });
  return {
    watchPosition,
    clearWatch,
    deliver: (lat, lon, accuracy, timestamp) => {
      lastSuccess?.({
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
        timestamp,
        toJSON: () => ({}),
      } as unknown as GeolocationPosition);
    },
    fail: (code) => {
      lastError?.({
        code,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: '',
      } as unknown as GeolocationPositionError);
    },
  };
}

describe('GeolocationController — Slow preset min-dispatch throttle (10 s)', () => {
  let mock: MockGeolocation;
  let originalGeolocation: typeof navigator.geolocation;
  let onFix: ReturnType<typeof vi.fn>;
  let controller: GeolocationController;

  beforeEach(() => {
    mock = makeMockGeolocation();
    originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: mock as unknown as Geolocation,
    });
    onFix = vi.fn();
    controller = new GeolocationController({
      onFix,
      onPermissionDenied: vi.fn(),
      onPositionUnavailable: vi.fn(),
      onTimeout: vi.fn(),
    });
  });

  afterEach(() => {
    controller.dispose();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  test('drops fixes that arrive < 10 s apart on Slow preset', () => {
    controller.start('slow');
    mock.deliver(25.0, 121.0, 10, 1_000_000);
    mock.deliver(25.0001, 121.0001, 10, 1_005_000); // 5 s later — drop
    mock.deliver(25.0002, 121.0002, 10, 1_011_000); // 11 s later — accept
    expect(onFix).toHaveBeenCalledTimes(2);
    expect(onFix.mock.calls[0][0].timestamp).toBe(1_000_000);
    expect(onFix.mock.calls[1][0].timestamp).toBe(1_011_000);
  });

  test('Smart preset does not throttle (every fix dispatched)', () => {
    controller.start('smart');
    mock.deliver(25.0, 121.0, 10, 1_000_000);
    mock.deliver(25.0001, 121.0001, 10, 1_002_000);
    mock.deliver(25.0002, 121.0002, 10, 1_004_000);
    expect(onFix).toHaveBeenCalledTimes(3);
  });

  test('Fast preset does not throttle', () => {
    controller.start('fast');
    mock.deliver(25.0, 121.0, 10, 1_000_000);
    mock.deliver(25.0001, 121.0001, 10, 1_000_500);
    mock.deliver(25.0002, 121.0002, 10, 1_001_000);
    expect(onFix).toHaveBeenCalledTimes(3);
  });
});

// Smart promote-on-movement burst was originally specified in research §R1
// but dropped from the implementation to fit the +6 KB per-feature bundle
// budget (see plan.md Complexity Tracking). The Smart preset now relies on
// the browser's built-in cadence governance + maximumAge: 5_000.
