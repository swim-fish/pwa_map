/**
 * Pure helper for the drag-to-reorder list (feature 010, contracts/drag-reorder-interaction.md).
 *
 * Same-position no-op: when from === to, returns the same reference so the
 * commit step in FormatToggle can detect "no change" without an array
 * comparison (Invariant 5).
 */
export function reorderArray<T>(arr: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return arr;
  if (from < 0 || from >= arr.length) return arr;
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
