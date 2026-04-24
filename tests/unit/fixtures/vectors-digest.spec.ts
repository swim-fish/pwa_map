import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, test, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const vectorsPath = resolve(here, 'test-vectors.json');
const digestPath = resolve(here, 'vectors-digest.txt');

describe('test-vectors.json integrity', () => {
  test('SHA-256 matches the pinned vectors-digest.txt', () => {
    const buf = readFileSync(vectorsPath);
    const actual = createHash('sha256').update(buf).digest('hex');
    const pinned = readFileSync(digestPath, 'utf8').trim().split(/\s+/)[0];
    expect(
      actual,
      `test-vectors.json drifted from pinned digest.\n  actual: ${actual}\n  pinned: ${pinned}\n` +
        'If this is an intentional reference-document upgrade, update vectors-digest.txt and log an ADR (Principle V).',
    ).toBe(pinned);
  });
});
