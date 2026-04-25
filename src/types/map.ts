import type { BasemapId } from '$map/sources';

export interface LayerSelection {
  readonly basemap: BasemapId;
  readonly overlay: boolean;
}
