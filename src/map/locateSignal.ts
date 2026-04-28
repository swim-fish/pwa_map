// Feature 013 — Svelte writable for the my-location feature's runtime state.
// See contracts/locate-machine.md + data-model.md.
//
// Component-local consumers subscribe via $locateSignal; the only mutator
// is applyLocateEvent(...). Mirrors the bearingSignal pattern from feature 006.

import { writable, type Readable } from 'svelte/store';
import {
  INITIAL_SNAPSHOT,
  transition,
  type LocateEvent,
  type LocateMachineSnapshot,
} from './locateMachine';

const store = writable<LocateMachineSnapshot>(INITIAL_SNAPSHOT);

export const locateSignal: Readable<LocateMachineSnapshot> = {
  subscribe: store.subscribe,
};

export function applyLocateEvent(event: LocateEvent): void {
  store.update((current) => transition(current, event));
}

export const __TESTING__ = {
  resetLocateSignal(): void {
    store.set(INITIAL_SNAPSHOT);
  },
};
