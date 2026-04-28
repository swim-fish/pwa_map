import type { WGS84DD } from '$types/coord';
import type { LayerSelection } from '$types/map';
import { findSource, type BasemapId } from './sources';
import { buildStyle } from './styleBuilder';

export interface MapMoveEvent {
  readonly center: WGS84DD;
  readonly zoom: number;
}

export interface MapControllerOptions {
  readonly container: HTMLElement;
  readonly center: WGS84DD;
  readonly zoom: number;
}

export interface TileFailEvent {
  readonly failedId: BasemapId;
  readonly revertedTo: BasemapId;
}

type Handler = (e: MapMoveEvent) => void;
type TileFailHandler = (e: TileFailEvent) => void;
type BearingHandler = (deg: number) => void;

function normaliseBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const FAILURE_WINDOW_MS = 5000;
const FAILURE_THRESHOLD = 3;

interface FailureSnapshot {
  readonly previous: LayerSelection;
  readonly attemptedBasemap: BasemapId;
  errorCount: number;
  windowStartedAt: number;
}

export class MapController {
  private disposed = false;
  private readonly moveHandlers = new Set<Handler>();
  private readonly moveEndHandlers = new Set<Handler>();
  private readonly tileFailHandlers = new Set<TileFailHandler>();
  private readonly bearingHandlers = new Set<BearingHandler>();
  private underlying: unknown = null;
  private currentCenter: WGS84DD;
  private currentZoom: number;
  private currentBearing = 0;
  private wheelOverrideAttached = false;
  private currentLayer: LayerSelection = { basemap: 'osm-standard', overlay: false };
  private failureSnapshot: FailureSnapshot | null = null;

  constructor(options: MapControllerOptions) {
    this.currentCenter = options.center;
    this.currentZoom = options.zoom;
    void options.container; // bound when the tile source is wired in US1 (T031)
  }

  onMove(handler: Handler): () => void {
    this.moveHandlers.add(handler);
    return () => this.moveHandlers.delete(handler);
  }

  onMoveEnd(handler: Handler): () => void {
    this.moveEndHandlers.add(handler);
    return () => this.moveEndHandlers.delete(handler);
  }

  emitMove(e: MapMoveEvent): void {
    this.currentCenter = e.center;
    this.currentZoom = e.zoom;
    for (const h of this.moveHandlers) h(e);
  }

  emitMoveEnd(e: MapMoveEvent): void {
    this.currentCenter = e.center;
    this.currentZoom = e.zoom;
    for (const h of this.moveEndHandlers) h(e);
  }

  get center(): WGS84DD {
    return this.currentCenter;
  }

  get zoom(): number {
    return this.currentZoom;
  }

  attachUnderlying(map: unknown): void {
    this.underlying = map;
  }

  getUnderlying(): unknown {
    return this.underlying;
  }

  get layerSelection(): LayerSelection {
    return this.currentLayer;
  }

  setLayerSelection(selection: LayerSelection): void {
    this.currentLayer = selection;
    this.applyStyle(selection);
  }

  setBasemap(basemap: BasemapId, overlay: boolean): void {
    const previous = this.currentLayer;
    const next: LayerSelection = { basemap, overlay };
    if (previous.basemap === basemap && previous.overlay === overlay) return;
    this.currentLayer = next;
    this.applyStyle(next);
    if (basemap !== previous.basemap) {
      this.failureSnapshot = {
        previous,
        attemptedBasemap: basemap,
        errorCount: 0,
        windowStartedAt: Date.now(),
      };
    } else {
      // Pure overlay toggle — no failure-snapshot reset.
    }
  }

  onTileFail(handler: TileFailHandler): () => void {
    this.tileFailHandlers.add(handler);
    return () => this.tileFailHandlers.delete(handler);
  }

  recordTileError(sourceId: string, options: { fatal?: boolean } = {}): void {
    const snap = this.failureSnapshot;
    if (!snap) return;
    if (sourceId !== snap.attemptedBasemap) return;
    if (Date.now() - snap.windowStartedAt > FAILURE_WINDOW_MS) {
      this.failureSnapshot = null;
      return;
    }
    snap.errorCount += 1;
    if (options.fatal === true || snap.errorCount >= FAILURE_THRESHOLD) {
      this.revertFromFailure();
    }
  }

  // Visible for test/internal use only.
  expireFailureWindowForTests(): void {
    if (this.failureSnapshot) {
      this.failureSnapshot = {
        ...this.failureSnapshot,
        windowStartedAt: Date.now() - FAILURE_WINDOW_MS - 1000,
      };
    }
  }

  private revertFromFailure(): void {
    const snap = this.failureSnapshot;
    if (!snap) return;
    this.failureSnapshot = null;
    const failedId = snap.attemptedBasemap;
    const revertedTo = snap.previous.basemap;
    this.currentLayer = snap.previous;
    this.applyStyle(snap.previous);
    const event: TileFailEvent = { failedId, revertedTo };
    for (const h of this.tileFailHandlers) h(event);
  }

  private applyStyle(selection: LayerSelection): void {
    const map = this.underlying as { setStyle?: (s: unknown) => void } | null;
    if (!map?.setStyle) return;
    const basemapSrc = findSource(selection.basemap);
    if (!basemapSrc) return;
    const overlaySrc = selection.overlay ? (findSource('google-road-overlay') ?? null) : null;
    const style = buildStyle(basemapSrc, overlaySrc);
    map.setStyle(style);
  }

  flyTo(target: WGS84DD, options: { zoom?: number; duration?: number } = {}): void {
    const map = this.underlying as {
      flyTo: (opts: {
        center: [number, number];
        zoom?: number;
        duration?: number;
        essential?: boolean;
      }) => void;
      getZoom?: () => number;
      setCenter?: (c: [number, number]) => void;
    } | null;
    if (!map) {
      this.currentCenter = target;
      return;
    }
    const currentZoom = map.getZoom ? map.getZoom() : this.currentZoom;
    const nextZoom = options.zoom ?? currentZoom;
    if (typeof map.flyTo === 'function') {
      map.flyTo({
        center: [target.lon as number, target.lat as number],
        zoom: nextZoom,
        duration: options.duration ?? 600,
        essential: true,
      });
    } else {
      map.setCenter?.([target.lon as number, target.lat as number]);
    }
    this.currentCenter = target;
    this.currentZoom = nextZoom;
  }

  // ===== Feature 006 — bearing channel =====

  getBearing(): number {
    const map = this.underlying as { getBearing?: () => number } | null;
    if (!map?.getBearing) return 0;
    return normaliseBearing(map.getBearing());
  }

  onBearing(handler: BearingHandler): () => void {
    this.bearingHandlers.add(handler);
    handler(this.getBearing());
    return () => this.bearingHandlers.delete(handler);
  }

  emitBearing(deg: number): void {
    const next = normaliseBearing(deg);
    if (Math.abs(next - this.currentBearing) < 1e-9) return;
    this.currentBearing = next;
    for (const h of this.bearingHandlers) h(next);
  }

  resetBearing(animated: boolean): void {
    const map = this.underlying as {
      easeTo: (opts: { bearing: number; duration: number }) => void;
      setBearing: (deg: number) => void;
      getBearing?: () => number;
    } | null;
    if (!map) return;
    const current = map.getBearing ? map.getBearing() : 0;
    const distFromZero = Math.min(Math.abs(current), Math.abs(360 - current));
    if (distFromZero <= 0.5) return;
    if (animated) {
      map.easeTo({ bearing: 0, duration: 600 });
    } else {
      map.setBearing(0);
    }
  }

  zoomBy(delta: number, animated: boolean): void {
    const map = this.underlying as {
      easeTo: (opts: {
        zoom: number;
        around: { lat: number; lng: number };
        duration: number;
      }) => void;
      zoomTo: (
        zoom: number,
        opts: { around: { lat: number; lng: number }; duration: number; animate: boolean },
      ) => void;
      getZoom: () => number;
      getCenter: () => { lat: number; lng: number };
      getMinZoom: () => number;
      getMaxZoom: () => number;
    } | null;
    if (!map) return;
    const current = map.getZoom();
    const target = clamp(current + delta, map.getMinZoom(), map.getMaxZoom());
    if (Math.abs(target - current) < 1e-6) return;
    const around = map.getCenter();
    if (animated) {
      map.easeTo({ zoom: target, around, duration: 200 });
    } else {
      map.zoomTo(target, { around, duration: 0, animate: false });
    }
  }

  // ===== Feature 013 — locate marker + recenter =====
  //
  // The `isRecentering` guard distinguishes our own programmatic
  // `recenterTo` from user-initiated `dragstart`. App.svelte reads
  // `isRecenteringForLocate` while subscribed to the underlying map's
  // `move` events: when truthy, the move is ours, not the user's.

  private recenteringForLocate = false;

  get isRecenteringForLocate(): boolean {
    return this.recenteringForLocate;
  }

  recenterTo(target: WGS84DD, animated: boolean): void {
    const map = this.underlying as {
      easeTo?: (opts: { center: [number, number]; duration: number; essential: boolean }) => void;
      setCenter?: (c: [number, number]) => void;
      once?: (event: string, handler: () => void) => void;
    } | null;
    if (!map) {
      this.currentCenter = target;
      return;
    }
    this.recenteringForLocate = true;
    const lngLat: [number, number] = [target.lon as number, target.lat as number];
    const release = (): void => {
      this.recenteringForLocate = false;
    };
    if (animated && map.easeTo) {
      map.easeTo({ center: lngLat, duration: 400, essential: true });
      // Release the guard on the next moveend; if the engine does not
      // fire one (no-op recenter), release on a microtask fallback.
      if (map.once) {
        map.once('moveend', release);
      } else {
        Promise.resolve().then(release);
      }
    } else {
      map.setCenter?.(lngLat);
      Promise.resolve().then(release);
    }
    this.currentCenter = target;
  }

  attachWheelOverride(): void {
    if (this.wheelOverrideAttached) return;
    const map = this.underlying as {
      scrollZoom?: { disable: () => void };
      getCanvasContainer?: () => HTMLElement;
    } | null;
    if (!map) return;
    map.scrollZoom?.disable();
    const target = map.getCanvasContainer?.() ?? null;
    if (!target) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const zoomDelta = clamp(-event.deltaY / 100, -1, 1);
      this.zoomBy(zoomDelta, false);
    };
    target.addEventListener('wheel', onWheel, { passive: false });
    this.wheelOverrideAttached = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.moveHandlers.clear();
    this.moveEndHandlers.clear();
    this.tileFailHandlers.clear();
    this.bearingHandlers.clear();
    const u = this.underlying as { remove?: () => void } | null;
    u?.remove?.();
    this.underlying = null;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
