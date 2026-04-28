// Feature 013 — Svelte writable bridging the persisted locateFrequency
// preference and any subscriber that wants to live-apply changes
// (currently LocateButton.svelte's running watcher per FR-025).
//
// Direct readers of the preference (e.g. LocateButton's first start
// from Off) should still call `loadLocateFrequency()` from
// preferences.ts; this store is only for change notification.

import { writable, type Readable } from 'svelte/store';
import {
  loadLocateFrequency,
  saveLocateFrequency,
  type LocateFrequencyPreset,
} from './preferences';

const store = writable<LocateFrequencyPreset>(loadLocateFrequency());

export const locateFrequencyStore: Readable<LocateFrequencyPreset> = {
  subscribe: store.subscribe,
};

export function setLocateFrequency(value: LocateFrequencyPreset): void {
  saveLocateFrequency(value);
  store.set(value);
}

export const __TESTING__ = {
  resetForTests(): void {
    store.set(loadLocateFrequency());
  },
};
