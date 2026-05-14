import type { LocateFrequencyPreset, LocatePermissionState, PositionFix } from './locateMachine';

/**
 * Geolocation watcher wrapper for the my-location feature (013 + 014).
 *
 * - Translates frequency presets → `PositionOptions`. On the Smart preset
 *   the controller additionally runs a "promote on movement" branch
 *   (feature 014): when two consecutive fixes show motion ≥ 1 m/s, a
 *   second concurrent high-accuracy `watchPosition` subscription runs
 *   for 5 s, then tears down. Restores feature 013's SC-005 deferred
 *   contract — see specs/014-smart-promote-cadence/plan.md.
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
const SMART_MOVEMENT_BURST_MS = 5_000;
const SMART_MOVEMENT_THRESHOLD_MPS = 1;
const EARTH_RADIUS_M = 6_371_000;

const BURST_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
};

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
  // Feature 014 — Smart promote-on-movement state cluster.
  private burstWatchId: number | null = null;
  private burstTimer: ReturnType<typeof setTimeout> | null = null;
  private previousFix: PositionFix | null = null;
  private previousFixWasMoving = false;

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
    // Preset switch (or re-subscribe on the same preset): tear down any
    // active burst before swapping the base subscription's options.
    // Also drop the prior `previousFix` so the next fix is treated as a
    // fresh baseline — without this, a smart → fast → smart toggle would
    // leak motion history across subscriptions and let a burst trigger
    // after only one in-session moving pair. PR #7 review (Codex P2).
    this.endBurst();
    this.previousFix = null;
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
    this.endBurst();
    if (typeof navigator !== 'undefined' && navigator.geolocation && this.baseWatchId !== null) {
      navigator.geolocation.clearWatch(this.baseWatchId);
    }
    this.baseWatchId = null;
    this.preset = null;
    this.lastAcceptedFix = null;
    this.previousFix = null;
    this.previousFixWasMoving = false;
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
    // Feature 014 — consider a high-accuracy burst on the Smart preset.
    // Runs AFTER onFix so the consumer sees this fix immediately; the
    // burst only affects subsequent cadence.
    this.maybePromoteOnMovement(fix);
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

  // Two-consecutive-moving-pairs rule prevents single GPS jitter spikes
  // from triggering a wasteful burst (feature 014 research §R1).
  private maybePromoteOnMovement(fix: PositionFix): void {
    if (this.disposed || this.preset !== 'smart') return;
    if (this.burstWatchId !== null) {
      // Burst already in flight; keep `previousFix` current so the
      // post-burst comparison uses the latest reading, but do not
      // consider spawning another burst.
      this.previousFix = fix;
      return;
    }
    if (this.previousFix === null) {
      this.previousFix = fix;
      this.previousFixWasMoving = false;
      return;
    }
    const dt = (fix.timestamp - this.previousFix.timestamp) / 1000;
    if (dt <= 0) return;
    const dist = this.haversineMeters(this.previousFix, fix);
    const isMoving = dist / dt >= SMART_MOVEMENT_THRESHOLD_MPS;
    if (isMoving && this.previousFixWasMoving) {
      this.startBurst();
    }
    this.previousFixWasMoving = isMoving;
    this.previousFix = fix;
  }

  private startBurst(): void {
    if (this.burstWatchId !== null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    try {
      this.burstWatchId = navigator.geolocation.watchPosition(
        (pos) => this.handlePosition(pos),
        (err) => this.handleError(err),
        BURST_WATCH_OPTIONS,
      );
      this.burstTimer = setTimeout(() => this.endBurst(), SMART_MOVEMENT_BURST_MS);
    } catch {
      // A burst-specific throw is non-fatal: the base subscription is
      // still healthy and the user is still seeing fixes. Surfacing a
      // toast for a cadence-only failure would confuse them — research §R3.
      this.burstWatchId = null;
      this.burstTimer = null;
      this.previousFixWasMoving = false;
    }
  }

  private endBurst(): void {
    if (this.burstWatchId !== null) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.burstWatchId);
      }
      this.burstWatchId = null;
    }
    if (this.burstTimer !== null) {
      clearTimeout(this.burstTimer);
      this.burstTimer = null;
    }
    this.previousFixWasMoving = false;
  }

  private haversineMeters(a: PositionFix, b: PositionFix): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
}
