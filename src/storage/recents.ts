import type { CoordinateKind } from '$types/coord';
import { ALL_COORDINATE_KINDS } from '$types/coord';
import type { FormatSelection, RecentEntry, RecentList } from '$types/goto';

export const RECENTS_KEY = 'pwa_map:gotoHistory_v1' as const;
export const MAX_RECENTS = 10 as const;
const RAW_MAX_LENGTH = 256;

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isCoordinateKind(v: unknown): v is CoordinateKind {
  return typeof v === 'string' && (ALL_COORDINATE_KINDS as readonly string[]).includes(v);
}

function isFormatSelection(v: unknown): v is FormatSelection {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.kind === 'auto') return true;
  if (o.kind === 'fixed') return isCoordinateKind(o.value);
  return false;
}

function isRecentEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (!isFormatSelection(o.format)) return false;
  if (typeof o.raw !== 'string') return false;
  if (o.raw.length === 0 || o.raw.length > RAW_MAX_LENGTH) return false;
  if (typeof o.createdAt !== 'number' || !Number.isFinite(o.createdAt) || o.createdAt < 0)
    return false;
  return true;
}

function validateList(raw: unknown): RecentList | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.entries)) return null;
  if (!o.entries.every(isRecentEntry)) return null;
  const trimmed = (o.entries as RecentEntry[]).slice(0, MAX_RECENTS);
  return { version: 1, entries: trimmed };
}

function emptyList(): RecentList {
  return { version: 1, entries: [] };
}

function sameSelection(a: FormatSelection, b: FormatSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'auto' && b.kind === 'auto') return true;
  if (a.kind === 'fixed' && b.kind === 'fixed') return a.value === b.value;
  return false;
}

export function loadRecents(): RecentList {
  const s = safeStorage();
  if (!s) return emptyList();
  const raw = s.getItem(RECENTS_KEY);
  if (!raw) return emptyList();
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateList(parsed) ?? emptyList();
  } catch {
    return emptyList();
  }
}

export function saveRecents(list: RecentList): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

export function addRecent(
  list: RecentList,
  format: FormatSelection,
  raw: string,
  now?: number,
): RecentList {
  const createdAt = now ?? Date.now();
  const filtered = list.entries.filter((e) => !(sameSelection(e.format, format) && e.raw === raw));
  const next: RecentEntry = { format, raw, createdAt };
  const merged = [next, ...filtered].slice(0, MAX_RECENTS);
  return { version: 1, entries: merged };
}

export function removeRecent(list: RecentList, format: FormatSelection, raw: string): RecentList {
  const filtered = list.entries.filter((e) => !(sameSelection(e.format, format) && e.raw === raw));
  if (filtered.length === list.entries.length) return list;
  return { version: 1, entries: filtered };
}
