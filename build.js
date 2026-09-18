#!/usr/bin/env node
/* ============================================================================
   Inline everything into one HTML file.

   Three targets, one composer:

       node build.js              → dist/index.html      the deliverable
       node build.js --3d         → + dist/index-3d.html  with the 3D presenter
       node build.js --artifact   → + dist/artifact.html  for a hosted Artifact
       node build.js --no-config  → omit config.js (composes with all of them)

   Every run rebuilds dist/index.html; the flags ADD targets rather than
   replacing it. So dist/index.html is never accidentally a 3D build.

   ── WHY THE 3D PRESENTER IS A SEPARATE FILE ───────────────────────────────
   dist/index.html has one promise and it is narrow and absolute: copy it to a
   booth machine, unplug the network, double-click it, press F11. That promise
   is why the fonts are data URIs and why there is no bundler here. It is also
   why this target carries NO TalkingHead bytes and NO avatar GLB: the vendor
   bundle is 0.8 MB and the base64 of the GLB is several times that, and a deck
   that takes ten seconds to paint has already lost the room.

   Nothing is lost by leaving them out. src/avatar3d.js is built so that
   Avatar3D.create() ANSWERS NULL rather than throwing when window.TalkingHead
   is missing, and the Presenter then uses the canvas bust — the same path a
   blocklisted GPU or prefers-reduced-motion takes. "No 3D in this file" is a
   size decision, never a broken page.

   The module inliner is deliberately small: it understands the handful of
   import/export forms this repo actually uses, in dependency order. It is not a
   bundler and does not pretend to be — if the import style changes, change this
   or reach for esbuild.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const bytes = p => fs.readFileSync(path.join(ROOT, p));
const exists = p => fs.existsSync(path.join(ROOT, p));

/* Dependency order, leaves first. avatar3d.js imports avatar.js, presenter.js
   imports both it and voice.js, app.js imports presenter.js — so the two 3D
   files sit between voice.js and ask.js. Get this wrong and the built file
   still parses; it just dies at `Presenter is not defined` on first paint. */
const MODULES = [
  'src/knowledge.js',
  'src/scenes.js',
  'src/avatar.js',
  'src/voice.js',
  'src/avatar3d.js',
  'src/presenter.js',
  'src/ask.js',
  'src/app.js',
];

/* Past this, a single HTML file stops being a thing you can hand somebody.
   The guard exists because the GLB is the one input whose size can change by
   an order of magnitude without anyone touching this file. */
const SIZE_LIMIT_MB = 12;

/** Strip ES module syntax so the files can share one classic script scope. */
function flatten(src) {
  return src
    // import ... from '...';  /  import '...';
    .replace(/^\s*import\s+[^;]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
    // export const/let/function/class → plain declaration
    .replace(/^\s*export\s+(?=(const|let|var|function|class|async))/gm, '')
    // export { ... };
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __default = ');
}

/* Flattening puts every module in one scope, so two modules that each declare a
   private `sleep` become a SyntaxError that only shows up in the built file.
   Catch it here rather than in a browser on a stand. */
function assertNoCollisions(flattened) {
  const owners = new Map();
  const problems = [];
  for (const [file, src] of flattened) {
    const names = new Set();
    // column 0 only — anything indented is inside a function and cannot collide
    for (const m of src.matchAll(/^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      names.add(m[1]);
    }
    for (const n of names) {
      if (owners.has(n)) problems.push(`${n} — declared in both ${owners.get(n)} and ${file}`);
      else owners.set(n, file);
    }
  }
  if (problems.length) {
    console.error('top-level name collisions — the built file would not parse:');
    problems.forEach(p => console.error('  ✗ ' + p));
    process.exit(1);
  }
}

/* ── the one function every splice goes through ───────────────────────────
   Replace once, LITERALLY, and fail loudly if the seam has moved. Two separate
   traps, both of which produce a build that "succeeds":

   1. $-EXPANSION. String.replace(re, string) is not a literal splice — it
      expands $&, $1, $` and $' IN THE REPLACEMENT. vendor/talkinghead.bundle.js
      contains exactly one `$&`, in minified three.js:

          turn{setMask:function($){re!==$&&!P&&(o.colorMask($,$,$,$),re=

      `$&` means "the text that was matched", so splicing the bundle in as a
      string re-inserts the <script src="vendor/talkinghead.bundle.js"></script>
      tag it was replacing into the middle of the bundle. The symptoms are
      `Unexpected token '<'`, the entire payload failing to parse, and ~8800px
      of horizontal overflow — from a character nobody typed, in a file nobody
      reads. Passing a FUNCTION opts out of $-expansion completely: its return
      value is used verbatim. So every splice goes through here, including the
      CSS/JS/config ones that are only safe today because no source in this repo
      happens to contain a `$&` yet. That is not a property worth depending on.

   2. A SILENT MISS. index.html belongs to another task. Reformat one of these
      tags and the regex stops matching, .replace() returns the string
      unchanged, and the build ships a page that loads nothing at all. No match,
      no build. */
function splice(html, re, text, what) {
  if (!re.test(html)) {
    console.error(`build.js: the ${what} seam is not in index.html.`);
    console.error(`  looking for: ${re}`);
    console.error('  index.html says these tags are matched literally. If one was');
    console.error('  renamed or reformatted, update the pattern here to match it.');
    process.exit(1);
  }
  return html.replace(re, () => text);
}

/* ── the other kind of seam: a POSITION rather than a replacement ─────────
   The artifact target does not replace these tags, it CUTS AT them, so it
   needs offsets rather than splice(). That is the only reason they were raw
   indexOf() — and it made them the two seams in this file that fail SILENTLY,
   because indexOf answers -1 instead of throwing and -1 is a usable offset.

   Both traps produce a build that exits 0:

   1. `<body>` GAINS AN ATTRIBUTE (<body class="dxc-2026">). indexOf → -1,
      slice(-1 + 6) = slice(5), and the "body" now starts five characters into
      `<!doctype html>` — so the doctype, <html>, <head> and the whole ~762 KB
      inlined <style> are copied into the artifact a second time. The file goes
      945 KB → 1.71 MB. Loud, but only by luck: what catches it today is the
      1.4 MB cap in tests/build.test.mjs, which reports it as a SIZE failure and
      sends you looking at the fonts.

   2. `<style>` GAINS AN ATTRIBUTE. indexOf → -1, slice(-1, N) is empty, and the
      artifact ships with NO CSS AT ALL. It gets SMALLER, so every size
      assertion passes; nothing else asserted the artifact contains any CSS.
      That one is silent end to end and it is exactly what a brand pass trips.

   So: no literal, no build. The message names the literal that moved, because
   the person reading it is holding a reformatted index.html and needs to know
   which tag this file was promised. */
function at(html, literal, what, { last = false } = {}) {
  const i = last ? html.lastIndexOf(literal) : html.indexOf(literal);
  if (i < 0) {
    console.error(`build.js: cannot find ${JSON.stringify(literal)} — the ${what} seam has moved.`);
    console.error('  dist/artifact.html is cut out of the canvas build by OFFSET, so this tag is');
    console.error('  matched literally. If it was renamed, reformatted, or given an attribute,');
    console.error('  update the literal here to match it.');
    // Where to look, because it is not the same file for both tags and the
    // <style> one sends people grepping index.html for a tag that was never in it.
    console.error(literal.includes('style')
      ? '  NOTE: <style> is not in index.html — THIS file emits it, at the styles.css seam above.'
      : '  It is in index.html.');
    process.exit(1);
  }
  return i;
}

/* Seam S5 — the two OPTIONAL classic scripts at the bottom of index.html.
   Matched literally, which is the promise index.html's comment makes on this
   file's behalf. */
const TAG_VENDOR = /<script src="vendor\/talkinghead\.bundle\.js"><\/script>\n?/;
const TAG_GLB = /<script src="assets\/avatar-glb\.js"><\/script>\n?/;

/**
 * The `window.AIB_AVATAR_GLB_B64 = '...'` shim, or null if there is no avatar.
 *
 * It has to be base64 in the page rather than a URL to fetch: Chrome CORS-blocks
 * fetch() of a file:// URL even for a sibling file, so a relative assets/avatar.glb
 * cannot load from a double-clicked page. src/avatar3d.js turns the base64 back
 * into a Blob object URL. docs/TALKINGHEAD.md trap 3.
 *
 * assets/avatar-glb.js is generated (and validated) elsewhere, so prefer it when
 * it is on disk. Falling back to encoding assets/avatar.glb here is what stops a
 * stale-or-missing generated file silently shipping a 3D build with no avatar in
 * it — the visible symptom of which is, unhelpfully, the canvas bust.
 */
function avatarGlbShim() {
  if (exists('assets/avatar-glb.js')) {
    return { js: read('assets/avatar-glb.js'), from: 'assets/avatar-glb.js', glbBytes: 0 };
  }
  if (exists('assets/avatar.glb')) {
    const raw = bytes('assets/avatar.glb');
    // base64's alphabet is [A-Za-z0-9+/=] — no quote, no backslash, no `</script`
    // and no `$`, so this is safe both to quote and to inline. The GLB is the
    // only input here for which that is worth stating rather than assuming.
    return {
      js: `window.AIB_AVATAR_GLB_B64 = "${raw.toString('base64')}";`,
      from: 'assets/avatar.glb',
      glbBytes: raw.length,
    };
  }
  return null;
}

const mb = n => (n / 1024 / 1024).toFixed(2) + ' MB';

function write(name, html) {
  const out = path.join(ROOT, 'dist', name);
  fs.writeFileSync(out, html);
  // Byte length, not html.length: the sources are full of em dashes and arrows,
  // and a UTF-16 code-unit count under-reports the file you actually ship.
  return Buffer.byteLength(html, 'utf8');
}

function build({ withConfig = true, want3d = false, wantArtifact = false } = {}) {
  const shell = read('index.html');
  const css = read('assets/fonts.css') + '\n' + read('src/styles.css');
  const flattened = MODULES.map(m => [m, flatten(read(m))]);
  assertNoCollisions(flattened);
  const js = flattened.map(([m, src]) => `/* ─── ${m} ${'─'.repeat(Math.max(0, 58 - m.length))} */\n` + src)
    .join('\n\n');

  const configJs = withConfig && exists('config.js') ? read('config.js') : '';

  /* Everything common to all three targets. The S5 tags are deliberately left
     in place here — each target below decides what becomes of them. */
  let base = shell;
  base = splice(base, /<link rel="stylesheet" href="assets\/fonts\.css">\s*\n?/, '', 'fonts.css');
  base = splice(base, /<link rel="stylesheet" href="src\/styles\.css">/, `<style>\n${css}\n</style>`, 'styles.css');
  base = splice(base, /<script src="config\.js"[^>]*><\/script>/,
    configJs ? `<script>\n${configJs}\n</script>` : '<script>window.AIB_CONFIG = window.AIB_CONFIG || {};</script>',
    'config.js');
  base = splice(base, /<script type="module" src="src\/app\.js"><\/script>/, `<script>\n${js}\n</script>`, 'app.js');

  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

  /* ── target 1: dist/index.html — the deliverable ─────────────────────────
     Both S5 tags come OUT rather than being left to 404. A missing relative
     script under file:// is ERR_FILE_NOT_FOUND: four red lines in the console
     of a machine on a stand, and shoot.js counts console errors as failures. */
  let canvas = splice(base, TAG_VENDOR, '', 'TalkingHead bundle');
  canvas = splice(canvas, TAG_GLB, '', 'avatar GLB');
  const indexBytes = write('index.html', canvas);

  const kb = (read('src/knowledge.js').match(/^\s*id:\s*'/gm) || []).length;
  const scenes = (read('src/scenes.js').match(/^\s*id:\s*'/gm) || []).length;
  console.log(`dist/index.html     ${mb(indexBytes)}  canvas presenter, no network`);
  console.log(`  ${scenes} scenes · ${kb} knowledge entries · config ${configJs ? 'INLINED' : 'omitted'}`);
  if (configJs) console.log('  ⚠  a key is baked into this file — do not hand it out');

  /* ── target 2: dist/index-3d.html — the same page, plus the presenter ──── */
  if (want3d) {
    const vendorJs = exists('vendor/talkinghead.bundle.js') ? read('vendor/talkinghead.bundle.js') : null;
    const shim = avatarGlbShim();

    let three = vendorJs
      ? splice(base, TAG_VENDOR, `<script>\n${vendorJs}\n</script>`, 'TalkingHead bundle')
      : splice(base, TAG_VENDOR, '', 'TalkingHead bundle');
    three = shim
      ? splice(three, TAG_GLB, `<script>\n${shim.js}\n</script>`, 'avatar GLB')
      : splice(three, TAG_GLB, '', 'avatar GLB');

    const threeBytes = write('index-3d.html', three);
    const parts = [
      vendorJs ? `TalkingHead ${mb(Buffer.byteLength(vendorJs, 'utf8'))}` : null,
      shim ? `GLB from ${shim.from}` : null,
    ].filter(Boolean).join(' · ');
    console.log(`dist/index-3d.html  ${mb(threeBytes)}  ${parts || 'nothing to add — see below'}`);

    if (!vendorJs) {
      console.log('  ⚠  vendor/talkinghead.bundle.js is missing, so this file has no 3D in it.');
      console.log('     Regenerate it with: npm ci && node vendor/build-vendor.mjs');
    }
    if (!shim) {
      console.log('  ⚠  no assets/avatar-glb.js and no assets/avatar.glb — this file will');
      console.log('     fall back to the canvas bust. See docs/TALKINGHEAD.md.');
    }
    if (threeBytes > SIZE_LIMIT_MB * 1024 * 1024) {
      // Loud on purpose. An HTML file this big is not a thing you email, put on
      // a stick, or open on a booth laptop, and the cause is always the same.
      console.log('');
      console.log(`  ⚠⚠  ${mb(threeBytes)} — this is NOT a deliverable (the ceiling is ~${SIZE_LIMIT_MB} MB).`);
      if (shim && shim.glbBytes) {
        console.log(`      assets/avatar.glb is ${mb(shim.glbBytes)}; base64 makes that ~${mb(shim.glbBytes * 4 / 3)}.`);
      } else if (shim) {
        console.log(`      The payload is ${shim.from}; the GLB behind it needs compressing.`);
      }
      console.log('      Compress the avatar first:  node tools/convert-valid-avatar.mjs');
      console.log('      A rigged, viseme-complete avatar belongs in the 2-3 MB range.');
      console.log('');
    }
  }

  /* ── target 3: dist/artifact.html ────────────────────────────────────────
     A Claude Artifact supplies its own <!doctype>/<head>/<body> and wraps what
     it is given, so the hosted preview needs the same page with that
     scaffolding removed and the theme stamped by script instead of on <html>.

     Built from the CANVAS page, never the 3D one, and that is not a size
     decision: a published Artifact's CSP blocks external hosts, and an inline
     payload of tens of megabytes would not survive the round trip anyway. */
  if (wantArtifact) {
    /* Every offset below goes through at(), and the lengths come off the
       literals rather than being typed as 6 and 8 — the two magic numbers that
       silently become wrong the moment a tag gains an attribute. */
    const BODY = '<body>', BODY_END = '</body>', STYLE = '<style>', STYLE_END = '</style>';
    const body = canvas
      .slice(at(canvas, BODY, 'artifact <body>') + BODY.length,
        at(canvas, BODY_END, 'artifact </body>', { last: true }))
      .trim();
    const head = canvas.slice(at(canvas, STYLE, 'artifact <style>'),
      at(canvas, STYLE_END, 'artifact </style>') + STYLE_END.length);
    const artifactBytes = write('artifact.html',
      `<title>Airport in a Box — walkthrough</title>\n${head}\n` +
      `<script>document.documentElement.dataset.theme = ` +
      `localStorage.getItem('aib-theme') || 'dark';</script>\n${body}\n`);
    console.log(`dist/artifact.html  ${mb(artifactBytes)}  head/body scaffolding stripped for hosting`);
  }
}

build({
  withConfig: !process.argv.includes('--no-config'),
  want3d: process.argv.includes('--3d'),
  wantArtifact: process.argv.includes('--artifact'),
});
