import type { Zone } from '$types/coord';

export function pickZone(lon: number): Zone {
  return lon >= 120 ? 121 : 119;
}

export const ZONE_CENTRAL_MERIDIAN: Readonly<Record<Zone, number>> = {
  119: 119,
  121: 121,
};
