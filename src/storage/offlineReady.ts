// Feature 004 — single-purpose flag for the "available offline" toast.
// Kept separate from `pwa_map:prefs` so ADR 0021's additive-evolution
// invariant on the prefs blob is untouched.

const KEY = 'pwa_map:offlineReadyShown';

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function hasShownOfflineReady(): boolean {
  const s = safeStorage();
  if (!s) return false;
  try {
    return s.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markOfflineReadyShown(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(KEY, '1');
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

export const __OFFLINE_READY_KEY = KEY;
