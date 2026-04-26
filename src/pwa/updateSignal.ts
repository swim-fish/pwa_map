// Feature 004 — Svelte stores driving the update prompt and the
// one-shot "available offline" toast. See contracts/update-signal.md
// for the public contract; data-model.md §1 + §7 for state shapes.

import { writable, type Readable } from 'svelte/store';

export interface UpdatePromptState {
  readonly visible: boolean;
  readonly postponedUntil: number | null;
  readonly confirmUpdate: (() => Promise<void>) | null;
}

export interface OfflineReadyState {
  readonly visible: boolean;
}

const POSTPONE_MS = 30 * 60 * 1000;

function initialUpdate(): UpdatePromptState {
  return { visible: false, postponedUntil: null, confirmUpdate: null };
}

function initialOfflineReady(): OfflineReadyState {
  return { visible: false };
}

const updateStore = writable<UpdatePromptState>(initialUpdate());
const offlineReadyStore = writable<OfflineReadyState>(initialOfflineReady());

export const updateSignal: Readable<UpdatePromptState> = {
  subscribe: updateStore.subscribe,
};

export const offlineReadySignal: Readable<OfflineReadyState> = {
  subscribe: offlineReadyStore.subscribe,
};

export function fireNeedRefresh(confirmUpdate: () => Promise<void>): void {
  updateStore.update((s) => {
    const inWindow = s.postponedUntil !== null && Date.now() < s.postponedUntil;
    return {
      ...s,
      visible: !inWindow,
      confirmUpdate,
    };
  });
}

export function postpone(now: number = Date.now()): void {
  updateStore.update((s) => ({
    ...s,
    visible: false,
    postponedUntil: now + POSTPONE_MS,
  }));
}

export async function confirm(): Promise<void> {
  let captured: (() => Promise<void>) | null = null;
  updateStore.update((s) => {
    captured = s.confirmUpdate;
    return s;
  });
  const fn = captured as (() => Promise<void>) | null;
  if (fn === null) return;
  await fn();
}

export function fireOfflineReady(): void {
  offlineReadyStore.update((s) => (s.visible ? s : { visible: true }));
}

export function dismissOfflineReady(): void {
  offlineReadyStore.update((s) => (s.visible ? { visible: false } : s));
}

export function __resetForTests(): void {
  updateStore.set(initialUpdate());
  offlineReadyStore.set(initialOfflineReady());
}

export const __TESTING__ = { POSTPONE_MS };
