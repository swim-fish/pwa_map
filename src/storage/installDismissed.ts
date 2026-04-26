// Feature 005 — corruption-tolerant reader/writer for the install dismissal
// timestamp. See contracts/install-dismissed-storage.md §1–§3 and research D4.

const KEY = 'pwa_map:installDismissedUntil';

export const __INSTALL_DISMISSED_KEY = KEY;
export const DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getDismissedUntil(): number | null {
  const s = safeStorage();
  if (!s) return null;
  let raw: string | null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) return null;
  if (n <= Date.now()) return null;
  return n;
}

export function setDismissedUntil(timestampMs: number): void {
  if (!Number.isFinite(timestampMs)) return;
  const n = Math.floor(timestampMs);
  if (!Number.isSafeInteger(n) || n <= 0) return;
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(KEY, String(n));
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}
