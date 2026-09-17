#!/usr/bin/env node
/* ============================================================================
   Regenerate vendor/talkinghead.bundle.js.

       node vendor/build-vendor.mjs

   The bundle it writes IS committed (like dist/index.html and the 731 KB
   assets/fonts.css) because the deliverable is a file you double-click on a
   booth machine with no network and no npm. This script exists so that blob is
   reproducible rather than mysterious: same pinned deps in, byte-identical
   bundle out.

   ── The four flags, and why each one is load-bearing ──────────────────────

   --bundle          pulls three + talkinghead + lipsync-en into one file. No
                     bare-specifier imports survive, so no importmap is needed
                     and build.js's module inliner stays sufficient.

   --format=iife     a CLASSIC script, not an ES module. index.html is built by
                     flattening modules into one <script>; a <script type=module>
                     would be a second, differently-scoped world.

   --minify          831 KB instead of 1.8 MB, inside a file that is already
                     ~890 KB. It all gets base64'd into one page in the end.

   --define:import.meta.url='"file:///bundled/"'
                     THE non-obvious one. talkinghead.mjs line 34 runs at module
                     scope, before any of your code:

                         const workletUrl = new URL('./playback-worklet.js',
                                                    import.meta.url);

                     esbuild has no import.meta in an IIFE, so it emits
                     `var import_meta = {}` and that becomes
                     `new URL('./playback-worklet.js', undefined)` — which THROWS
                     "Invalid URL" and kills the entire bundle on load, before
                     TalkingHead is ever assigned. Defining the base to any valid
                     absolute URL makes the expression evaluate and the value is
                     then never used: workletUrl is only read by streamStart(),
                     the WebSocket streaming path, which this project does not
                     call. If you ever DO want streaming, this is the line that
                     has to change — the worklet would need to be a real reachable
                     URL (or inlined as a blob).

   Legal comments are left at esbuild's default (collected at end of file) so the
   MIT headers of three and talkinghead ship with the code. Don't add
   --legal-comments=none to save bytes; that is a licence term, not a comment.
   ========================================================================== */

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'vendor/talkinghead.bundle.js';
const ENTRY = 'vendor/entry.mjs';

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const dev = pkg.devDependencies;

/* A drifted node_modules produces a different bundle from the same source and
   nothing downstream would notice until the avatar broke on a stand. The
   versions are pinned exactly in package.json precisely so this check is
   meaningful — if it fires, run `npm ci`, don't edit the pin. */
function assertPinned(name) {
  const p = path.join(ROOT, 'node_modules', name, 'package.json');
  let installed;
  try { installed = JSON.parse(readFileSync(p, 'utf8')).version; }
  catch { console.error(`✗ ${name} is not installed — run: npm ci`); process.exit(1); }
  if (installed !== dev[name]) {
    console.error(`✗ ${name} is ${installed}, package.json pins ${dev[name]} — run: npm ci`);
    process.exit(1);
  }
  return installed;
}

const three = assertPinned('three');
const th = assertPinned('@met4citizen/talkinghead');
const esb = assertPinned('esbuild');

/* No timestamp, no hostname, nothing that varies between runs — the committed
   bundle has to regenerate byte-identically or `git diff` stops being a check. */
const banner = [
  '/* GENERATED — do not edit. Regenerate: node vendor/build-vendor.mjs',
  `   @met4citizen/talkinghead ${th} (MIT) + three ${three} (MIT), bundled by esbuild ${esb}.`,
  '   Exposes exactly window.TalkingHead and window.LipsyncEn. See docs/TALKINGHEAD.md. */',
].join('\n');

const args = [
  ENTRY,
  '--bundle',
  '--format=iife',
  '--minify',
  /* argv, not a shell line — the inner double quotes ARE the define's value,
     which must be JS source for a string literal, not a bare token. */
  '--define:import.meta.url="file:///bundled/"',
  `--banner:js=${banner}`,
  `--outfile=${OUT}`,
];

const bin = path.join(ROOT, 'node_modules', '.bin', 'esbuild');
const r = spawnSync(bin, args, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
if (r.status !== 0) { console.error('✗ esbuild failed'); process.exit(r.status ?? 1); }

/* Assert the trap is actually defused rather than assuming the flag took. An
   `import_meta.url` surviving here is a bundle that throws on load. */
const out = readFileSync(path.join(ROOT, OUT), 'utf8');
const leaked = (out.match(/import_meta\.url/g) || []).length;
const defined = (out.match(/file:\/\/\/bundled\//g) || []).length;
if (leaked > 0 || defined < 1) {
  console.error(`✗ import.meta.url was not substituted (leaked=${leaked}, defined=${defined})`);
  console.error('  the bundle would throw "Invalid URL" on load — do not commit it');
  process.exit(1);
}

console.log(`${OUT}  ${(statSync(path.join(ROOT, OUT)).size / 1024).toFixed(0)} KB`);
console.log(`  talkinghead ${th} · three ${three} · esbuild ${esb}`);
console.log(`  import.meta.url substituted (${defined} site${defined === 1 ? '' : 's'}), 0 leaked`);
console.log('  verify it still runs:  node vendor/smoke.cjs');
