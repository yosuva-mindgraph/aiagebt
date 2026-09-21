/* ============================================================================
   The three targets as FILES.

   ── why grep -c TalkingHead is NOT the test ───────────────────────────────
   src/avatar3d.js and index.html legitimately say "TalkingHead" 32 times: in
   prose, in the fallback guard (`typeof window.TalkingHead !== 'function'`), and
   in the comment that explains seam S5. All of that is INLINED into the canvas
   build and must be, because the fallback guard is what makes the canvas build
   work. A name-count assertion would be red on a correct file.

   The same trap catches the obvious second guess: `AIB_AVATAR_GLB_B64` also
   appears twice in dist/index.html, for the same reason — once in index.html's
   seam-S5 comment and once as `const b64 = window.AIB_AVATAR_GLB_B64` in
   avatar3d.js. Neither is a byte of avatar.

   So the assertions below test for PAYLOAD, not for names:

     setMask:function             minified three.js, only in the vendor bundle
     @met4citizen/talkinghead     the bundle's own banner
     window.AIB_AVATAR_GLB_B64 = "   the shim ASSIGNMENT — the base64 itself

   Each one is positively controlled: it must be ABSENT from index.html and
   artifact.html and PRESENT in index-3d.html. A marker that is absent everywhere
   proves nothing, and that is the failure mode of a test written from memory.

   ── the $& splice trap ────────────────────────────────────────────────────
   vendor/talkinghead.bundle.js contains exactly one `$&`:

       turn{setMask:function($){re!==$&&!P&&(o.colorMask($,$,$,$),re=

   String.replace(re, string) expands `$&` in the REPLACEMENT to the matched
   text, so splicing the bundle in as a string re-inserts the <script src=...>
   tag into the middle of minified three.js. build.js passes a FUNCTION instead,
   which opts out of expansion entirely. The assertion is not "does the file
   contain $&" — it is that the inlined bundle is SHA256-IDENTICAL to the file on
   disk. Byte-for-byte or it did not survive.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/harness.mjs';

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const mb = n => (n / 1024 / 1024).toFixed(2) + ' MB';

/* Payload markers. `name` is what we call it in the report; `probe` is the
   literal that only the payload can produce. */
const PAYLOAD = [
  ['minified three.js (setMask:function)', 'setMask:function'],
  ['the bundle banner (@met4citizen/talkinghead)', '@met4citizen/talkinghead'],
  ['the GLB base64 shim (window.AIB_AVATAR_GLB_B64 = ")', 'window.AIB_AVATAR_GLB_B64 = "'],
];

/* The pre-rendered speech is the FOURTH payload, and the only one that goes the
   other way: the canvas targets carry it and the 3D one does not. It is
   tests/voice.test.mjs's subject; here it is only subtracted, so the size
   assertions below stay about the 3D payload they were written for. */
const VOICE_MARKER = 'window.AIB_VOICE_CLIPS = {';

function withoutVoice(html) {
  const at = html.indexOf(VOICE_MARKER);
  if (at < 0) return html;
  const open = html.lastIndexOf('<scr' + 'ipt>', at);
  const close = html.indexOf('\n</scr' + 'ipt>\n', at);
  if (open < 0 || close < 0) return html;
  return html.slice(0, open) + html.slice(close + 11);
}

export async function run(t) {
  const canvas = rd('dist/index.html');
  const artifact = rd('dist/artifact.html');
  const three = rd('dist/index-3d.html');
  const bundle = fs.readFileSync(path.join(ROOT, 'vendor/talkinghead.bundle.js'), 'utf8');

  const size = rel => fs.statSync(path.join(ROOT, rel)).size;
  t.note(`index.html ${mb(size('dist/index.html'))} · artifact.html ${mb(size('dist/artifact.html'))} · index-3d.html ${mb(size('dist/index-3d.html'))}`);

  /* ── 1. the canvas build must stay canvas ───────────────────────────── */
  for (const [name, probe] of PAYLOAD) {
    // positive control first: a probe that is missing everywhere is a test that
    // cannot fail, which is worse than no test.
    t.ok(three.includes(probe), `positive control: index-3d.html DOES carry ${name}`,
      `${three.split(probe).length - 1} occurrence(s)`);
    t.ok(!canvas.includes(probe), `dist/index.html carries no ${name}`,
      `${canvas.split(probe).length - 1} occurrence(s)`);
    t.ok(!artifact.includes(probe), `dist/artifact.html carries no ${name}`,
      `${artifact.split(probe).length - 1} occurrence(s)`);
  }

  /* The size proof, independent of any marker: both canvas targets are under a
     megabyte, and the vendor bundle alone is 0.79 MB. They cannot be in there.

     Measured MINUS the pre-rendered speech, which is ~4.4 MB of base64 audio
     the canvas targets now carry ON PURPOSE. Taking it out is not a loophole —
     it is what keeps this assertion about the thing it was written to catch. A
     target that had somehow acquired the vendor bundle would still be ~0.8 MB
     over once the audio is discounted. tests/voice.test.mjs owns the audio
     itself: which targets may carry it, and the ceilings it has to stay under. */
  for (const [label, out] of [['index.html', canvas], ['artifact.html', artifact]]) {
    const bare = Buffer.byteLength(withoutVoice(out), 'utf8');
    t.ok(bare < 1.4 * 1024 * 1024,
      `dist/${label} is under 1.4 MB with its speech discounted (the bundle alone is 0.79 MB)`,
      `${mb(bare)} of page${bare === Buffer.byteLength(out, 'utf8') ? ' (no speech in this build)' : ` + ${mb(size('dist/' + label) - bare)} of speech`}`);
  }

  /* ── 1b. the artifact is the page MINUS its scaffolding, PLUS its CSS ──
     build.js cuts dist/artifact.html out of the canvas build by offset, at
     `<body>` and `<style>`. Before this block, nothing here described the SHAPE
     of the result, and that gap had a specific consequence: if the <style> seam
     moved, the head came out EMPTY, the artifact shipped with no CSS at all,
     and — because it got SMALLER — it sailed through every size assertion
     above. A hosted preview of unstyled HTML, green gate. The five checks below
     are what make that impossible; the build now also refuses to produce it.

     `<head` is deliberately matched as `<head[\s>]`: the page's own <header>
     starts with those five characters and a bare substring test is red on a
     correct file. */
  t.ok(artifact.startsWith('<title>'),
    'dist/artifact.html starts at <title> — no page scaffolding above it',
    JSON.stringify(artifact.slice(0, 48)));
  for (const [name, re] of [
    ['<!doctype', /<!doctype/i], ['<html>', /<html[\s>]/i], ['<head>', /<head[\s>]/i],
  ]) {
    t.ok(!re.test(artifact),
      `dist/artifact.html carries no ${name} (an Artifact supplies its own)`,
      `${(artifact.match(new RegExp(re.source, 'gi')) || []).length} occurrence(s)`);
  }
  const styleBlock = artifact.match(/<style>([\s\S]*?)<\/style>/);
  const styleKb = styleBlock ? Buffer.byteLength(styleBlock[1], 'utf8') / 1024 : 0;
  t.ok(styleKb > 10,
    'dist/artifact.html still carries its CSS — a >10 KB <style> block, not an empty one',
    styleBlock ? `${styleKb.toFixed(1)} KB between <style> and </style>` : 'NO <style> BLOCK AT ALL');

  // And the S5 tags are removed rather than left to 404 under file://.
  for (const [n, s] of [['index.html', canvas], ['artifact.html', artifact]]) {
    t.ok(!/<script src="vendor\/talkinghead\.bundle\.js">/.test(s)
      && !/<script src="assets\/avatar-glb\.js">/.test(s),
      `dist/${n} has no dangling seam-S5 <script src> to 404 on`);
  }

  /* ── 2. the $& splice trap: byte-for-byte or it did not survive ─────── */
  const bundleSha = sha(bundle);
  const head = bundle.slice(0, 120);
  const at = three.indexOf(head);
  t.ok(at > -1, 'the vendor bundle is locatable inside dist/index-3d.html', `offset ${at}`);
  if (at > -1) {
    const end = three.indexOf('\n</script>', at);
    const inlined = three.slice(at, end);
    t.ok(sha(inlined) === bundleSha,
      'the inlined bundle is sha256-identical to vendor/talkinghead.bundle.js',
      `inlined ${inlined.length}B ${sha(inlined).slice(0, 16)}… · on disk ${bundle.length}B ${bundleSha.slice(0, 16)}…`);
  }
  // The specific character that does the damage, named so a failure reads.
  const DOLLAR = 're!==$&&';
  t.eq(bundle.split(DOLLAR).length - 1, 1, `the bundle still contains exactly one "${DOLLAR}"`);
  t.eq(three.split(DOLLAR).length - 1, 1, `dist/index-3d.html preserved "${DOLLAR}" verbatim (no $-expansion)`);
  t.ok(!/<script src="vendor\/talkinghead\.bundle\.js"><\/script>[\s\S]{0,80}colorMask/.test(three),
    'the seam-S5 tag was not re-injected into the middle of three.js');

  /* ── 3. the --3d size ceiling, and that the guard still bites ───────── */
  const buildSrc = rd('build.js');
  /* Anchored at column 0 on the declaration itself, so this reads the CONSTANT
     rather than the first place the name appears — build.js now discusses the
     ceiling in prose above the 3D target as well, and an unanchored match is
     one edit away from picking up a number out of a sentence. */
  const limit = Number((buildSrc.match(/^const SIZE_LIMIT_MB = (\d+);$/m) || [])[1]);
  t.ok(Number.isFinite(limit) && limit > 0, 'build.js still declares a SIZE_LIMIT_MB', `${limit} MB`);
  const threeBytes = size('dist/index-3d.html');
  t.ok(threeBytes < limit * 1024 * 1024,
    `dist/index-3d.html is under build.js's ${limit} MB ceiling`,
    `${mb(threeBytes)} of ${limit}.00 MB — ${mb(limit * 1024 * 1024 - threeBytes)} of headroom`);
  t.ok(fs.statSync(path.join(ROOT, 'assets/avatar.glb')).size < 8 * 1024 * 1024,
    'assets/avatar.glb is small enough to base64 into a deliverable',
    `${fs.statSync(path.join(ROOT, 'assets/avatar.glb')).size} B = ${mb(fs.statSync(path.join(ROOT, 'assets/avatar.glb')).size)}`);

  /* A guard nobody has watched fire is a comment. Build the same build.js in a
     scratch tree with an oversized GLB and read its stdout. Nothing in the real
     repo is touched — build.js resolves everything from its own __dirname, so a
     COPY of it (never a symlink, which would resolve back here) builds the
     scratch tree instead. */
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'aib-sizeguard-'));
  try {
    fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(scratch, 'build.js'));
    for (const l of ['index.html', 'src', 'vendor']) {
      fs.symlinkSync(path.join(ROOT, l), path.join(scratch, l));
    }
    fs.mkdirSync(path.join(scratch, 'assets'));
    fs.symlinkSync(path.join(ROOT, 'assets/fonts.css'), path.join(scratch, 'assets/fonts.css'));
    // 10 MB of GLB → ~13.3 MB of base64 → comfortably over a 12 MB ceiling.
    const real = fs.readFileSync(path.join(ROOT, 'assets/avatar.glb'));
    fs.writeFileSync(path.join(scratch, 'assets/avatar.glb'),
      Buffer.concat([real, Buffer.alloc(10 * 1024 * 1024)]));

    const out = execFileSync(process.execPath, ['build.js', '--3d'], { cwd: scratch, encoding: 'utf8' });
    const fired = /NOT a deliverable/.test(out) && new RegExp(`ceiling is ~${limit} MB`).test(out);
    t.ok(fired, 'the size guard fires on an oversized GLB',
      (out.split('\n').find(l => /NOT a deliverable/.test(l)) || out.slice(-200)).trim());
    t.ok(/Compress the avatar first/.test(out),
      'the guard names the fix (tools/convert-valid-avatar.mjs)');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  /* ── 4. .gitignore ──────────────────────────────────────────────────── */
  const ignored = rel => {
    try {
      execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT });
      return true;
    } catch { return false; }
  };
  t.ok(ignored('dist/index-3d.html'),
    'dist/index-3d.html is gitignored (10 MB does not belong in git)');
  t.ok(!ignored('dist/index.html'),
    'dist/index.html is still TRACKED — it is the thing you double-click');
  t.ok(!ignored('dist/artifact.html'), 'dist/artifact.html is still tracked');
  t.ok(ignored('config.js'), 'config.js (the key) is still gitignored');

  /* ── 5. the build is reproducible byte-for-byte ─────────────────────── */
  const before = [size('dist/index.html'), sha(rd('dist/index.html'))];
  execFileSync(process.execPath, ['build.js', '--3d', '--artifact'], { cwd: ROOT });
  t.ok(sha(rd('dist/index.html')) === before[1],
    'rebuilding produces an identical dist/index.html', before[1].slice(0, 16) + '…');
}
