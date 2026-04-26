#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');

// Budget is for the initial (entry) bundle the user pays for on first paint.
// Large tree-shaken libraries (maplibre-gl) are split into async chunks via
// vite's manualChunks config and are NOT counted against the initial budget.
const ENTRY_JS_BUDGET_BYTES = 200 * 1024;
const CSS_BUDGET_BYTES = 20 * 1024;

// Async chunks allowed up to this size each (individual chunk budget).
const ASYNC_CHUNK_BUDGET_BYTES = 250 * 1024;

// Per-feature delta gate (feature 005 SC-007: ≤ 4 KB gzipped delta from
// the prior shipped baseline on the entry JS bundle). The baseline is
// stored in scripts/bundle-baseline.json and updated by running
// `npm run bundle-size -- --update-baseline` from a known-good build.
const ENTRY_JS_DELTA_BUDGET_BYTES = 4 * 1024;
const BASELINE_FILE = join(process.cwd(), 'scripts', 'bundle-baseline.json');

// Chunks whose names start with one of these prefixes are treated as deferred.
const DEFERRED_CHUNK_PREFIXES = ['maplibre', 'workbox-window'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function measure(file) {
  const buf = await readFile(file);
  return gzipSync(buf).byteLength;
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

async function main() {
  const updateBaseline = process.argv.includes('--update-baseline');

  try {
    await stat(DIST_ASSETS);
  } catch {
    console.error(`[bundle-size] ${DIST_ASSETS} not found. Run \`npm run build\` first.`);
    process.exit(2);
  }

  const files = await walk(DIST_ASSETS);
  const js = files.filter((f) => f.endsWith('.js'));
  const css = files.filter((f) => f.endsWith('.css'));

  const deferredNames = new Set();
  const entryJsFiles = [];
  for (const file of js) {
    const name = basename(file);
    const deferred = DEFERRED_CHUNK_PREFIXES.some((p) => name.startsWith(p));
    if (deferred) deferredNames.add(name);
    else entryJsFiles.push(file);
  }

  let entryTotal = 0;
  for (const file of entryJsFiles) entryTotal += await measure(file);

  let cssTotal = 0;
  for (const file of css) cssTotal += await measure(file);

  console.info(
    `[bundle-size] Entry JS gzipped: ${fmt(entryTotal)} / budget ${fmt(ENTRY_JS_BUDGET_BYTES)}`,
  );
  console.info(`[bundle-size] CSS gzipped: ${fmt(cssTotal)} / budget ${fmt(CSS_BUDGET_BYTES)}`);

  let failed = false;
  if (entryTotal > ENTRY_JS_BUDGET_BYTES) {
    console.error(
      `[bundle-size] FAIL: entry JS ${fmt(entryTotal)} exceeds budget ${fmt(ENTRY_JS_BUDGET_BYTES)}.`,
    );
    failed = true;
  }
  if (cssTotal > CSS_BUDGET_BYTES) {
    console.error(
      `[bundle-size] FAIL: CSS ${fmt(cssTotal)} exceeds budget ${fmt(CSS_BUDGET_BYTES)}.`,
    );
    failed = true;
  }

  // Enforce a reasonable upper bound on each deferred chunk too.
  for (const file of js) {
    const name = basename(file);
    if (!deferredNames.has(name)) continue;
    const size = await measure(file);
    console.info(
      `[bundle-size] Async chunk ${name} gzipped: ${fmt(size)} / per-chunk budget ${fmt(ASYNC_CHUNK_BUDGET_BYTES)}`,
    );
    if (size > ASYNC_CHUNK_BUDGET_BYTES) {
      console.error(
        `[bundle-size] FAIL: async chunk ${name} ${fmt(size)} exceeds per-chunk budget ${fmt(ASYNC_CHUNK_BUDGET_BYTES)}.`,
      );
      failed = true;
    }
  }

  // Delta-from-baseline gate (feature 005 SC-007 enforcement).
  let baseline = null;
  try {
    const raw = await readFile(BASELINE_FILE, 'utf8');
    baseline = JSON.parse(raw);
  } catch {
    /* no baseline yet — first run or pre-005 */
  }

  if (updateBaseline) {
    const next = {
      entryJsBytes: entryTotal,
      cssBytes: cssTotal,
      capturedAt: new Date().toISOString(),
    };
    await writeFile(BASELINE_FILE, JSON.stringify(next, null, 2) + '\n');
    console.info(`[bundle-size] Baseline updated: ${BASELINE_FILE} (entry JS ${fmt(entryTotal)}).`);
  } else if (baseline !== null && typeof baseline.entryJsBytes === 'number') {
    const delta = entryTotal - baseline.entryJsBytes;
    console.info(
      `[bundle-size] Entry JS delta from baseline: ${delta >= 0 ? '+' : ''}${fmt(delta)} / per-feature delta budget ${fmt(ENTRY_JS_DELTA_BUDGET_BYTES)}`,
    );
    if (delta > ENTRY_JS_DELTA_BUDGET_BYTES) {
      console.error(
        `[bundle-size] FAIL: entry JS delta ${fmt(delta)} exceeds per-feature delta budget ${fmt(ENTRY_JS_DELTA_BUDGET_BYTES)}.`,
      );
      failed = true;
    }
  } else {
    console.warn(
      `[bundle-size] WARN: no baseline at ${BASELINE_FILE}. Run \`npm run bundle-size -- --update-baseline\` from a known-good build to capture one.`,
    );
  }

  if (failed) process.exit(1);
  console.info('[bundle-size] PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
