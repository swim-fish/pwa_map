// Feature 006 — Svelte writable for reactive bearing reads. Subscribes to
// MapController.onBearing once attached. See contracts/bearing-signal.md §1–§3.

import { writable, type Readable } from 'svelte/store';
import type { MapController } from './MapController';

export interface BearingState {
  readonly bearing: number;
}

function initialBearingState(): BearingState {
  return { bearing: 0 };
}

const store = writable<BearingState>(initialBearingState());

let detachPrev: (() => void) | null = null;

export const bearingSignal: Readable<BearingState> = {
  subscribe: store.subscribe,
};

export function attachToController(controller: MapController): () => void {
  if (detachPrev !== null) {
    detachPrev();
    detachPrev = null;
  }
  const unsub = controller.onBearing((deg: number) => {
    store.set({ bearing: deg });
  });
  detachPrev = unsub;
  return unsub;
}

export function __resetForTests(): void {
  if (detachPrev !== null) {
    detachPrev();
    detachPrev = null;
  }
  store.set(initialBearingState());
}
