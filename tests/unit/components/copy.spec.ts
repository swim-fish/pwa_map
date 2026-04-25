import { describe, test, expect, vi, beforeEach } from 'vitest';
import { copyReadout } from '../../../src/components/copy';

describe('copyReadout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('resolves ok when navigator.clipboard.writeText succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const r = await copyReadout('25.033611, 121.564472');
    expect(r.ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('25.033611, 121.564472');
  });

  test('resolves err when writeText rejects (permission denied)', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const r = await copyReadout('51R UH 55170 69437');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.messageKey).toBe('copy.permission.denied');
  });

  test('resolves err when clipboard API is absent', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const r = await copyReadout('B7039 BD32');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.messageKey).toBe('copy.fallback.unsupported');
  });
});
