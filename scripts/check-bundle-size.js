#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
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

  if (failed) process.exit(1);
  console.info('[bundle-size] PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
