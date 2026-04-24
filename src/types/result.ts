import type { CoordinateKind } from './coord';

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type RejectionCategory =
  | 'malformed'
  | 'out-of-range'
  | 'out-of-coverage'
  | 'unsupported-precision';

export interface Rejection {
  readonly category: RejectionCategory;
  readonly messageKey: string;
  readonly raw: string;
  readonly attemptedAs?: CoordinateKind;
}

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

export function reject(
  category: RejectionCategory,
  messageKey: string,
  raw: string,
  attemptedAs?: CoordinateKind,
): Rejection {
  return attemptedAs ? { category, messageKey, raw, attemptedAs } : { category, messageKey, raw };
}

const CATEGORY_PREFERENCE: Record<RejectionCategory, number> = {
  'out-of-coverage': 4,
  'out-of-range': 3,
  'unsupported-precision': 2,
  malformed: 1,
};

export function preferRejection(a: Rejection, b: Rejection): Rejection {
  return CATEGORY_PREFERENCE[a.category] >= CATEGORY_PREFERENCE[b.category] ? a : b;
}
