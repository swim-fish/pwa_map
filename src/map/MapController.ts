import type { WGS84DD } from '$types/coord';

export interface MapMoveEvent {
  readonly center: WGS84DD;
  readonly zoom: number;
}

export interface MapControllerOptions {
  readonly container: HTMLElement;
  readonly center: WGS84DD;
  readonly zoom: number;
}

type Handler = (e: MapMoveEvent) => void;

export class MapController {
  private disposed = false;
  private readonly moveHandlers = new Set<Handler>();
  private readonly moveEndHandlers = new Set<Handler>();
  private underlying: unknown = null;
  private currentCenter: WGS84DD;
  private currentZoom: number;

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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.moveHandlers.clear();
    this.moveEndHandlers.clear();
    const u = this.underlying as { remove?: () => void } | null;
    u?.remove?.();
    this.underlying = null;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
