import type { LocateFrequencyPreset, LocatePermissionState, PositionFix } from './locateMachine';

/**
 * Geolocation watcher wrapper for the my-location feature (013).
 *
 * - Translates frequency presets → `PositionOptions`. Smart relies on
 *   the browser's built-in cadence governance + `maximumAge: 5_000`
 *   (the originally proposed Smart-promote-on-movement burst was
 *   deferred during bundle trim — see plan.md Complexity Tracking
 *   and spec Addendum A2).
 * - Enforces a 10 s min-dispatch throttle on the Slow preset.
 * - Normalises native `PositionError` codes into discrete callbacks.
 * - Debounces repeated `POSITION_UNAVAILABLE` / `TIMEOUT` to once per 5 s.
 *
 * MUST be called synchronously from a user-gesture handler on first
 * activation (iOS Safari requirement).
 */

export interface GeolocationControllerOptions {
  readonly onFix: (fix: PositionFix) => void;
  readonly onPermissionDenied: () => void;
  readonly onPositionUnavailable: () => void;
  readonly onTimeout: () => void;
}

const SLOW_MIN_DISPATCH_MS = 10_000;
const ERROR_DEBOUNCE_MS = 5_000;

export function frequencyToWatchOptions(preset: LocateFrequencyPreset): PositionOptions {
  switch (preset) {
    case 'smart':
      return { enableHighAccuracy: false, maximumAge: 5_000, timeout: 30_000 };
    case 'fast':
      return { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 };
    case 'slow':
      return { enableHighAccuracy: false, maximumAge: 30_000, timeout: 60_000 };
  }
}

export class GeolocationController {
  private readonly options: GeolocationControllerOptions;
  private disposed = false;
  private preset: LocateFrequencyPreset | null = null;
  private baseWatchId: number | null = null;
  private lastAcceptedFix: PositionFix | null = null;
  private lastUnavailableEmitAt = 0;
  private lastTimeoutEmitAt = 0;

  constructor(options: GeolocationControllerOptions) {
    this.options = options;
  }

  async queryPermission(): Promise<LocatePermissionState> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unavailable';
    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!perms?.query) return 'prompt';
      const status = await perms.query({ name: 'geolocation' as PermissionName });
      const s = status.state as LocatePermissionState;
      if (s === 'granted' || s === 'denied' || s === 'prompt') return s;
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  start(preset: LocateFrequencyPreset): void {
    if (this.disposed) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.options.onPositionUnavailable();
      return;
    }
    // Idempotent: stop any prior subscription, then resubscribe with the new preset.
    if (this.baseWatchId !== null) {
      navigator.geolocation.clearWatch(this.baseWatchId);
      this.baseWatchId = null;
    }
    this.preset = preset;
    try {
      this.baseWatchId = navigator.geolocation.watchPosition(
        (pos) => this.handlePosition(pos),
        (err) => this.handleError(err),
        frequencyToWatchOptions(preset),
      );
    } catch {
      // Some environments expose `navigator.geolocation` but block
      // `watchPosition` synchronously (e.g., a Permissions-Policy
      // disallow on the embedding frame, or a Brave-shield-style
      // privacy override). Without this guard, the throw escapes the
      // user-gesture handler and leaves the locate machine in an
      // inconsistent state. Route to onPositionUnavailable so the
      // existing zh toast path surfaces. PR #5 review C-2 (Codex P2).
      this.preset = null;
      this.baseWatchId = null;
      this.options.onPositionUnavailable();
    }
  }

  stop(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.preset = null;
      this.lastAcceptedFix = null;
      return;
    }
    if (this.baseWatchId !== null) {
      navigator.geolocation.clearWatch(this.baseWatchId);
      this.baseWatchId = null;
    }
    this.preset = null;
    this.lastAcceptedFix = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
  }

  get isRunning(): boolean {
    return this.baseWatchId !== null;
  }

  get currentPreset(): LocateFrequencyPreset | null {
    return this.preset;
  }

  private handlePosition(pos: GeolocationPosition): void {
    if (this.disposed) return;
    const fix: PositionFix = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };

    // Slow preset: drop fixes that arrive < 10 s after the last accepted fix.
    if (this.preset === 'slow' && this.lastAcceptedFix !== null) {
      if (fix.timestamp - this.lastAcceptedFix.timestamp < SLOW_MIN_DISPATCH_MS) {
        return;
      }
    }

    this.lastAcceptedFix = fix;
    this.options.onFix(fix);
  }

  private handleError(err: GeolocationPositionError): void {
    if (this.disposed) return;
    const now = Date.now();
    switch (err.code) {
      case 1:
        // Permission denied — stop the watcher (terminal for this controller).
        this.stop();
        this.options.onPermissionDenied();
        return;
      case 2:
        if (now - this.lastUnavailableEmitAt >= ERROR_DEBOUNCE_MS) {
          this.lastUnavailableEmitAt = now;
          this.options.onPositionUnavailable();
        }
        return;
      case 3:
        if (now - this.lastTimeoutEmitAt >= ERROR_DEBOUNCE_MS) {
          this.lastTimeoutEmitAt = now;
          this.options.onTimeout();
        }
        return;
    }
  }
}
