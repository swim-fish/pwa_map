import type { Rejection } from '$types/result';
import { err, ok, reject, type Result } from '$types/result';

export async function copyReadout(display: string): Promise<Result<void, Rejection>> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return err(reject('malformed', 'copy.fallback.unsupported', display));
  }
  try {
    await navigator.clipboard.writeText(display);
    return ok(undefined);
  } catch {
    return err(reject('malformed', 'copy.permission.denied', display));
  }
}
