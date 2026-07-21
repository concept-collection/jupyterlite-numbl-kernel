#!/usr/bin/env node
/*
 * Make a `jupyter lite build` output cross-origin isolated:
 *   1. copy coi-serviceworker.js into the output root, and
 *   2. inject a <script> that registers it into every generated page's <head>.
 *
 * This synthesizes COOP/COEP headers client-side, so SharedArrayBuffer — and
 * thus numbl's cooperative cell interruption (the Stop button) — works on hosts
 * that can't set response headers, notably GitHub Pages. See
 * demo/coi-serviceworker.js.
 *
 * The <script> src is relative to each page's depth, all pointing at the single
 * root copy, so the service worker registers at the site root scope regardless
 * of the base path (works under both `/` locally and `/<repo>/` on Pages).
 *
 * Usage: node demo/inject-coi.mjs <output-dir>
 */
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync
} from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node demo/inject-coi.mjs <output-dir>');
  process.exit(1);
}

const SW = 'coi-serviceworker.js';
copyFileSync(join(here, SW), join(outDir, SW));

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* htmlFiles(p);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield p;
    }
  }
}

let count = 0;
for (const file of htmlFiles(outDir)) {
  const html = readFileSync(file, 'utf8');
  if (html.includes(SW)) {
    continue; // already injected
  }
  const depth = relative(outDir, dirname(file)).split(sep).filter(Boolean)
    .length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  const tag = `<script src="${prefix}${SW}"></script>`;
  // Inject as the first thing in <head> so isolation is gained (and the
  // one-time reload happens) before the heavy app bundle loads.
  const replaced = html.replace(/<head(\s[^>]*)?>/i, m => `${m}\n    ${tag}`);
  if (replaced === html) {
    continue; // no <head>, skip
  }
  writeFileSync(file, replaced);
  count++;
}
console.log(`coi: injected ${SW} into ${count} page(s) under ${outDir}`);
