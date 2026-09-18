/* ============================================================================
   THE ASSERTIONS NO SINGLE TASK COULD MAKE.

   Eight branches were built against eight slices of this repo. Each engineer saw
   their own slice and gated it there. This file exists for the checks that only
   become possible once all eight are in one tree — and for one structural check
   that generalises the failure this codebase has produced five separate times.

   ════════════════════════════════════════════════════════════════════════════
   §1 — BUILD CONSERVATION. The generic catcher.

   Five times in one session this repo shipped a build that was CORRECT IN
   SOURCE and BROKEN IN THE ARTIFACT:

     · the <style> splice missed and the artifact shipped with no CSS — and
       because it got SMALLER, it passed the size cap;
     · the body splice missed the same way;
     · String.replace honoured `$&` in the replacement and re-inserted a script
       tag into the middle of minified three.js;
     · a backtick inside a comment inside a template literal closed the literal
       and killed first paint;
     · the word "html" inside angle brackets, written in PROSE in a source
       comment, tripped the no-scaffolding assertion on a correct file.

   `node --check` passes on every one of those. assertNoCollisions() passes on
   every one of those. The existing suite catches each of them with a check
   written AFTER the fact, naming that specific symptom — three PAYLOAD probes, a
   sha256 of the vendor bundle, a >10 KB floor on the style block. Those are good
   checks and they stay. But they are a list of yesterday's accidents, and the
   sixth one will be a splice nobody has thought of yet.

   The generic property underneath all five is CONSERVATION:

       build.js is a pure inliner. It reads a fixed set of inputs, applies ONE
       documented transform (flatten(), which removes import/export lines), and
       splices the result into a shell at four named seams. Therefore EVERY
       RETAINED LINE OF EVERY INPUT MUST APPEAR, VERBATIM, IN EVERY TARGET THAT
       IS SUPPOSED TO CARRY IT.

   That is not a heuristic — it is what "inline" means. It is measured here at
   3,714 JS lines, 919 CSS lines and 146 shell lines per target, in about a
   second, with no browser. A splice that drops a region fails it. A replacement
   that corrupts a region fails it. A seam that moves fails it. None of those had
   to be predicted.

   It is deliberately COMMENT-BLIND, which is the other half: it compares source
   lines to output lines and never parses prose, so a tag written in a comment
   cannot trip it. That is failure five, which was a false positive in a TEST
   rather than a fault in the artifact.

   What conservation cannot see is failure four — text that survived intact but
   landed in the wrong JS context. Nothing static can: the bytes are all present
   and in order. That one needs the page to actually run, which is §2.

   §2 — FIRST PAINT. The runtime half of the same idea, and the reason it is
   here rather than assumed: a page can parse, satisfy every byte-level
   assertion in §1, and still paint nothing. §2 opens all three targets and
   requires each to reach a state that is impossible to fake — stylesheet
   applied (measured off a computed property, not the presence of a <style>
   tag), app constructed, presenter attached, shell laid out at a real size.

   ════════════════════════════════════════════════════════════════════════════
   §3-§7 — the five cross-branch assertions.

   §3  the aperture in LIGHT theme: Royal linework, translucent layers intact.
       This is the one that produces no error and no red test anywhere else.
   §4  a real question answered in BOTH themes, sheet rendered, jump chip
       resolving to a scene that exists.
   §5  the theme toggle round-tripping through localStorage across a reload.
   §6  both presenters up, and all twelve scenes narrating on each.
   §7  zero emoji in any built target.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { launch, openPage, ready, BUDGET, ROOT, TARGETS, fileUrl, sleep } from './lib/harness.mjs';

const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── §1 plumbing ────────────────────────────────────────────────────────── */

/* build.js's own list and its own transform. Kept in step by §1.0, which fails
   if build.js stops agreeing with either. */
const MODULES = [
  'src/icons.js', 'src/knowledge.js', 'src/scenes.js', 'src/avatar.js', 'src/voice.js',
  'src/avatar3d.js', 'src/presenter.js', 'src/ask.js', 'src/app.js',
];

const flatten = src => src
  .replace(/^\s*import\s+[^;]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
  .replace(/^\s*import\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
  .replace(/^\s*export\s+(?=(const|let|var|function|class|async))/gm, '')
  .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
  .replace(/^\s*export\s+default\s+/gm, 'const __default = ');

/* The four seams build.js splices, plus seam S5's two optional tags. These
   lines are CONSUMED by the build and so are exempt from conservation. */
const SEAM = /(<link rel="stylesheet" href="(assets\/fonts|src\/styles)\.css">|<script src="config\.js"|<script type="module" src="src\/app\.js">|<script src="vendor\/talkinghead\.bundle\.js">|<script src="assets\/avatar-glb\.js">)/;

/* dist/artifact.html is the page MINUS its document scaffolding — an Artifact
   supplies its own. These are the ONLY shell lines it may drop, and the list is
   exact in both directions: a line missing that is not here is a broken splice,
   and a line here that is still present means the strip did not happen. */
const ARTIFACT_DROPS = [
  '<!doctype html>',
  '<!-- Dark by default: this is a presentation surface, usually on a big panel in a',
  '     room with the lights down, and Midnight is the brand ground. Light is fully',
  '     designed and one click away — the toggle persists. -->',
  '<html lang="en" data-theme="dark">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="description" content="Iris walks you through Intelligent Airport: the airport platform from MindGraph and DXC.">',
  '</head>',
  '<body>',
  '</body>',
  '</html>',
];

/** Lines of `src` that are not blank and not a consumed seam. */
const meaningful = (src, skip = null) => src.split('\n')
  .filter(l => l.trim() && !(skip && skip.test(l)));

/** Which of `lines` are absent from the Set of output lines. */
const absent = (lines, outSet) => lines.filter(l => !outSet.has(l));

/* The cold open is modal and intercepts pointer events — by design, because
   that click is what unlocks audio autoplay. Anything that drives the page
   chrome has to get past it first, and it comes BACK on every reload. Skip
   rather than Start, so nothing is narrating underneath the assertions.
   app.js dismisses it by setting .hidden, so that is what is waited on. */
async function dismissColdOpen(page) {
  await page.click('#skipIntroBtn');
  await page.waitForFunction(() => document.querySelector('#overlay')?.hidden === true,
    null, { timeout: 10000 });
}

/* ── §3 plumbing ────────────────────────────────────────────────────────── */

/* Drive the aperture into a painted state and read its backing store back.
   The canvas is never filled with a background — _frame() starts with
   clearRect() — so the page colour shows through and the ALPHA CHANNEL of the
   image data is a direct readout of how translucent each layer was drawn.

   That is what makes this test possible at all. _alpha() handed a token it
   cannot parse returns the string unchanged, the alpha argument is dropped, and
   every layer paints opaque. There is no error and no warning; the only
   evidence is in the pixels, and it is in the alpha channel specifically. */
const PROBE_APERTURE = `(async () => {
  const av = window.app?.presenter?.backend?.avatar;
  if (!av) return { error: 'no canvas avatar on this backend' };

  av.setState('speaking');
  av.speak('Intelligent Airport keeps the whole estate on one governed foundation.', 3000);
  av.setLevel(0.6);
  await new Promise(r => setTimeout(r, 420));

  const c = av.c, ctx = av.ctx;
  const { width: W, height: H } = c;
  const d = ctx.getImageData(0, 0, W, H).data;

  const alphas = new Map();      // alpha byte -> count
  const colours = new Set();     // distinct rgba quadruples
  let ink = 0, blueish = 0, sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    ink++;
    alphas.set(a, (alphas.get(a) || 0) + 1);
    if (colours.size < 200000) colours.add((d[i] << 24 | d[i+1] << 16 | d[i+2] << 8 | a) >>> 0);
    sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2];
    if (d[i + 2] > d[i] && d[i + 2] > d[i + 1]) blueish++;
  }

  const opaque = alphas.get(255) || 0;
  const distinctAlphas = alphas.size;

  return {
    theme: document.documentElement.dataset.theme,
    W, H,
    tokens: { SKY: av.SKY, GOLD: av.GOLD, ROYAL: av.ROYAL, INK3: av.INK3 },
    onDark: av.onDark,
    ink,
    inkFraction: ink / (W * H),
    distinctAlphas,
    distinctColours: colours.size,
    opaqueFraction: ink ? opaque / ink : 0,
    blueFraction: ink ? blueish / ink : 0,
    meanRGB: ink ? [Math.round(sumR/ink), Math.round(sumG/ink), Math.round(sumB/ink)] : null,
    // the contract itself, called directly on the live instance
    alphaOfSky: av._alpha(av.SKY, 0.5),
    alphaOfRoyal: av._alpha(av.ROYAL, 0.5),
    alphaOfGold: av._alpha(av.GOLD, 0.5),
    alphaOfInk3: av._alpha(av.INK3, 0.5),
    // NEGATIVE CONTROL: an indirection is exactly what --peach is, and it must
    // fall straight through. If this ever returns rgba(), the probe above has
    // stopped being able to tell the two apart and §3 is decoration.
    alphaOfIndirection: av._alpha('var(--dxc-peach)', 0.5),
    alphaOfColorMix: av._alpha('color-mix(in srgb, #004AAC, white)', 0.5),
  };
})()`;

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/* ── §7 plumbing ────────────────────────────────────────────────────────── */

/* Deliberately broader than "the emoji the chooser used to use": any Extended
   Pictographic codepoint, any emoji-presentation codepoint, the Misc-Symbols
   and Dingbats block, regional indicators, and the VS16 selector that turns a
   plain glyph into an emoji one. A check that only knows the emoji that were
   removed cannot see the one somebody adds next week. */
const EMOJI = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|\u{FE0F}|[\u{1F1E6}-\u{1F1FF}])/gu;

/* ────────────────────────────────────────────────────────────────────────── */

export async function run(t) {
  const canvas = rd('dist/index.html');
  const artifact = rd('dist/artifact.html');
  const three = rd('dist/index-3d.html');

  /* ══ §1 BUILD CONSERVATION ═══════════════════════════════════════════════ */

  /* §1.0 — the derivation is load-bearing, so it is asserted before it is used.
     If build.js grows a tenth module or changes flatten(), the two lists here
     go stale and every check below silently narrows. */
  const declaredModules = (rd('build.js').match(/^\s*'(src\/[a-z0-9]+\.js)',$/gm) || [])
    .map(s => s.trim().replace(/^'|',$/g, ''));
  t.eq(declaredModules, MODULES, '§1.0 build.js still inlines exactly the modules this suite conserves');

  const flattenBody = rd('build.js').slice(
    rd('build.js').indexOf('function flatten(src)'),
    rd('build.js').indexOf('function assertNoCollisions'));
  const transforms = (flattenBody.match(/\.replace\(/g) || []).length;
  t.ok(transforms === 5, '§1.0 flatten() still applies exactly the 5 transforms mirrored here',
    `${transforms} .replace() call(s) in build.js's flatten()`);

  /* §1.1 — JS. Every retained line of every module, in all three targets. */
  const jsLines = MODULES.flatMap(m => meaningful(flatten(rd(m))).map(l => [m, l]));
  t.ok(jsLines.length > 3000, '§1.1 positive control: the module corpus is substantial',
    `${jsLines.length} retained JS lines across ${MODULES.length} modules`);

  for (const [label, out] of [['index.html', canvas], ['artifact.html', artifact], ['index-3d.html', three]]) {
    const set = new Set(out.split('\n'));
    const miss = jsLines.filter(([, l]) => !set.has(l));
    t.ok(miss.length === 0,
      `§1.1 dist/${label} conserves every line of every inlined module, verbatim`,
      miss.length ? `${miss.length} line(s) lost, e.g. ${miss[0][0]} ${JSON.stringify(miss[0][1].slice(0, 70))}`
        : `${jsLines.length}/${jsLines.length} lines`);
  }

  /* §1.2 — CSS. This is the check that would have caught the CSS-less artifact
     on its own, without anyone knowing the <style> seam was the fragile one. */
  const cssLines = meaningful(rd('assets/fonts.css') + '\n' + rd('src/styles.css'));
  t.ok(cssLines.length > 500, '§1.2 positive control: the stylesheet corpus is substantial',
    `${cssLines.length} lines of fonts.css + styles.css`);

  for (const [label, out] of [['index.html', canvas], ['artifact.html', artifact], ['index-3d.html', three]]) {
    const set = new Set(out.split('\n'));
    const miss = absent(cssLines, set);
    t.ok(miss.length === 0, `§1.2 dist/${label} conserves every line of the stylesheet, verbatim`,
      miss.length ? `${miss.length} line(s) lost, e.g. ${JSON.stringify(miss[0].slice(0, 70))}`
        : `${cssLines.length}/${cssLines.length} lines`);
  }

  /* §1.3 — the shell, minus the seams the build consumes. */
  const shellLines = meaningful(rd('index.html'), SEAM);
  t.ok(shellLines.length > 100, '§1.3 positive control: the shell corpus is substantial',
    `${shellLines.length} non-seam lines in index.html`);

  for (const [label, out] of [['index.html', canvas], ['index-3d.html', three]]) {
    const set = new Set(out.split('\n'));
    const miss = absent(shellLines, set);
    t.ok(miss.length === 0, `§1.3 dist/${label} conserves every non-seam line of the shell, verbatim`,
      miss.length ? `${miss.length} line(s) lost, e.g. ${JSON.stringify(miss[0].slice(0, 70))}`
        : `${shellLines.length}/${shellLines.length} lines`);
  }

  /* §1.4 — the artifact drops EXACTLY the document scaffolding. Both directions:
     nothing else may go missing, and everything on the list must actually be
     gone. A one-sided check here is how a splice that ate the body passes. */
  {
    const set = new Set(artifact.split('\n'));
    const miss = absent(shellLines, set);
    const expected = ARTIFACT_DROPS.filter(l => shellLines.includes(l));
    t.eq(miss.slice().sort(), expected.slice().sort(),
      '§1.4 dist/artifact.html drops EXACTLY the document scaffolding — no more, no less');
    t.ok(miss.length > 8, '§1.4 positive control: the strip actually happened',
      `${miss.length} scaffolding line(s) removed`);
  }

  /* §1.5 — the vendor bundle, byte-for-byte, in the one target that carries it.
     (build.test.mjs sha256s the inlined region it locates; this asserts the
     whole file is present as one verbatim substring, which is the same promise
     stated so that a splice cannot satisfy it by accident.) */
  {
    const bundle = rd('vendor/talkinghead.bundle.js');
    t.ok(three.includes(bundle),
      '§1.5 dist/index-3d.html carries vendor/talkinghead.bundle.js as one verbatim substring',
      `${(bundle.length / 1024).toFixed(0)} KB`);
    t.ok(!canvas.includes(bundle) && !artifact.includes(bundle),
      '§1.5 positive control: the canvas targets do NOT carry it');
  }

  /* §1.6 — NEGATIVE CONTROL. A conservation check that has never been seen to
     go red is a decoration. Corrupt one character of one line the way a bad
     splice would, and the same comparison must fail. */
  {
    const victim = cssLines.find(l => l.includes('--sky:'));
    const corrupted = canvas.replace(victim, victim.replace('--sky:', '--sky :'));
    const set = new Set(corrupted.split('\n'));
    const miss = absent(cssLines, set);
    t.ok(miss.length === 1 && miss[0] === victim,
      '§1.6 NEGATIVE CONTROL: a single corrupted line IS detected by §1.2',
      `${miss.length} line(s) reported: ${JSON.stringify((miss[0] || '').trim())}`);
  }

  /* ══ §2 FIRST PAINT ══════════════════════════════════════════════════════ */

  const browser = await launch();
  try {
    for (const [label, key, budget] of [
      ['index.html', 'canvas', BUDGET.canvas],
      ['artifact.html', 'artifact', BUDGET.canvas],
      ['index-3d.html', 'three', BUDGET.three],
    ]) {
      const { page, errors, ctx } = await openPage(browser, key, { budget });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: budget.attach });
      const paint = await page.evaluate(async () => {
        await window.app.ready;
        const shell = document.querySelector('#shell');
        const header = document.querySelector('header');
        const cs = getComputedStyle(document.documentElement);
        const bs = getComputedStyle(document.body);
        const hs = header ? getComputedStyle(header) : null;
        const r = shell ? shell.getBoundingClientRect() : { width: 0, height: 0 };
        return {
          // the stylesheet is APPLIED, not merely present: a custom property
          // that only styles.css defines, resolved off the live cascade.
          royal: cs.getPropertyValue('--royal').trim(),
          ink3: cs.getPropertyValue('--ink-3').trim(),
          bodyFont: bs.fontFamily,
          bodyBg: bs.backgroundColor,
          // and it has real layout, not a wall of unstyled block elements
          headerDisplay: hs ? hs.display : null,
          shellW: Math.round(r.width), shellH: Math.round(r.height),
          backend: window.app.presenter.backendKind,
          scenes: SCENES.length,
          sceneRows: document.querySelectorAll('#sceneList [data-i], #sceneList button, #sceneList .row').length,
        };
      });
      t.ok(HEX.test(paint.royal) && HEX.test(paint.ink3),
        `§2 dist/${label}: the stylesheet is APPLIED — tokens resolve off the live cascade`,
        `--royal ${paint.royal} · --ink-3 ${paint.ink3}`);
      t.ok(/DXC|Mono|sans/i.test(paint.bodyFont) && paint.bodyFont !== 'Times New Roman',
        `§2 dist/${label}: body is on the brand face, not the UA default`, paint.bodyFont);
      t.ok(paint.shellW > 600 && paint.shellH > 300,
        `§2 dist/${label}: #shell is laid out at a real size`, `${paint.shellW}×${paint.shellH}`);
      t.ok(paint.headerDisplay && paint.headerDisplay !== 'block',
        `§2 dist/${label}: the header is laid out by the stylesheet, not stacked as a default block`,
        String(paint.headerDisplay));
      t.ok(paint.scenes === 12, `§2 dist/${label}: twelve scenes are in the built file`, String(paint.scenes));
      t.ok(errors.length === 0, `§2 dist/${label}: reached first paint with no page errors`,
        JSON.stringify(errors.slice(0, 3)));
      await ctx.close();
    }

    /* ══ §3 THE APERTURE IN LIGHT THEME ════════════════════════════════════
       Royal linework, translucent layers intact. The failure this covers has
       no error, no warning and no other red test: _alpha() hands back an
       unparseable colour unchanged, the alpha is dropped, and the aperture
       renders as flat opaque slabs that still look deliberate in a screenshot.

       Both themes are measured so the comparison itself is the evidence. */
    const apertures = {};
    for (const theme of ['dark', 'light']) {
      const { page, errors, ctx } = await openPage(browser, 'canvas', {
        budget: BUDGET.canvas,
        initScript: `try { localStorage.setItem('aib-theme', ${JSON.stringify(theme)}); } catch {}`,
      });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });
      await page.evaluate(async th => {
        await window.app.ready;
        // belt and braces: the init script is the real path, but a box where
        // localStorage is unavailable under file:// must still be measurable.
        document.documentElement.dataset.theme = th;
      }, theme);
      await sleep(120);                       // the MutationObserver re-reads tokens
      const r = await page.evaluate(PROBE_APERTURE);
      apertures[theme] = r;
      t.ok(!r.error, `§3 [${theme}] the canvas aperture is the backend under test`, r.error || `${r.W}×${r.H}`);
      t.ok(errors.length === 0, `§3 [${theme}] no page errors while painting the aperture`,
        JSON.stringify(errors.slice(0, 3)));
      await ctx.close();
    }

    const L = apertures.light, D = apertures.dark;
    t.note(`light tokens ${JSON.stringify(L.tokens)}`);
    t.note(`dark  tokens ${JSON.stringify(D.tokens)}`);

    /* 3a. the four tokens are literal hex AT RUNTIME, in the light theme.
       guards.test.mjs asserts this against the stylesheet SOURCE; this asserts
       it against the cascade the built file actually resolves. */
    for (const [name, v] of Object.entries(L.tokens)) {
      t.ok(HEX.test(v), `§3 [light] ${name} resolves to literal hex in the built file`, v);
    }

    /* 3b. Royal. On Canvas both --sky and --royal are #004AAC — the platform's
       voice on paper — so the linework is Royal by construction, and onDark
       must have flipped or every compositing decision below it is inverted. */
    t.ok(L.tokens.SKY.toUpperCase() === '#004AAC' && L.tokens.ROYAL.toUpperCase() === '#004AAC',
      '§3 [light] the aperture draws in ROYAL — --sky and --royal are both #004AAC on Canvas',
      `SKY ${L.tokens.SKY} · ROYAL ${L.tokens.ROYAL}`);
    t.ok(L.onDark === false && D.onDark === true,
      '§3 onDark flipped with the theme — the aperture knows which way "brighter" points',
      `light ${L.onDark} · dark ${D.onDark}`);
    t.ok(L.blueFraction > 0.5,
      '§3 [light] the ink is BLUE — Royal linework, not the dark theme\'s palette left behind',
      `${(L.blueFraction * 100).toFixed(1)}% of ${L.ink} ink pixels have B > R and B > G · mean RGB ${JSON.stringify(L.meanRGB)}`);

    /* 3c. THE HEX CONTRACT, called directly on the live instance, with the
       negative control beside it. This is the assertion in its purest form. */
    t.ok(/^rgba\(0,74,172,0\.5\)$/.test(L.alphaOfSky),
      '§3 [light] _alpha(SKY, .5) returns a real rgba() — the hex contract holds end to end',
      L.alphaOfSky);
    for (const [n, v] of [['ROYAL', L.alphaOfRoyal], ['GOLD', L.alphaOfGold], ['INK3', L.alphaOfInk3]]) {
      t.ok(/^rgba\([\d.]+,[\d.]+,[\d.]+,0\.5\)$/.test(v),
        `§3 [light] _alpha(${n}, .5) returns a real rgba()`, v);
    }
    t.ok(L.alphaOfIndirection === 'var(--dxc-peach)' && /^color-mix/.test(L.alphaOfColorMix),
      '§3 NEGATIVE CONTROL: an indirection falls straight through _alpha(), alpha silently dropped',
      `${JSON.stringify(L.alphaOfIndirection)} · ${JSON.stringify(L.alphaOfColorMix)}`);

    /* 3d. and the pixels, which is the only place the failure is actually
       visible. The canvas is cleared, never filled, so its own alpha channel is
       a direct readout of how translucent each layer was drawn. Flat opaque
       slabs collapse this distribution to a handful of values at a=255. */
    t.ok(L.ink > 5000, '§3 [light] the aperture actually painted something to measure',
      `${L.ink} ink pixels (${(L.inkFraction * 100).toFixed(1)}% of the canvas)`);
    t.ok(L.distinctAlphas > 40,
      '§3 [light] TRANSLUCENT LAYERS INTACT — the canvas alpha channel is a distribution, not a switch',
      `${L.distinctAlphas} distinct alpha values across ${L.ink} ink pixels`);
    t.ok(L.opaqueFraction < 0.5,
      '§3 [light] most of the aperture is NOT fully opaque — this is what flat slabs would break',
      `${(L.opaqueFraction * 100).toFixed(1)}% of ink pixels are a=255`);
    t.ok(L.distinctColours > 1000,
      '§3 [light] the linework carries real gradient depth, not a few solid fills',
      `${L.distinctColours} distinct rgba values`);
    t.ok(D.distinctAlphas > 40 && D.opaqueFraction < 0.5,
      '§3 [dark] the same contract holds on Midnight',
      `${D.distinctAlphas} distinct alphas · ${(D.opaqueFraction * 100).toFixed(1)}% opaque`);
    t.ok(L.meanRGB[2] !== D.meanRGB[2] || L.meanRGB[0] !== D.meanRGB[0],
      '§3 the aperture RE-THEMED — light and dark are measurably different renders',
      `light ${JSON.stringify(L.meanRGB)} vs dark ${JSON.stringify(D.meanRGB)}`);

    /* ══ §4 A REAL QUESTION, IN BOTH THEMES ════════════════════════════════
       Sheet rendering, and the jump chip resolving to a scene that EXISTS.
       knowledge.js holds 38 scene ids by hand against scenes.js's twelve; a
       chip naming a scene that is gone is the bug that left the sheet stuck on
       "Looking that up…" with the answer already in hand. */
    for (const theme of ['dark', 'light']) {
      const { page, errors, ctx } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });
      const r = await page.evaluate(async th => {
        await window.app.ready;
        document.documentElement.dataset.theme = th;
        window.app.render(0, { play: false });
        window.app.handleAsk('What does the governance layer actually enforce?');
        const body = document.querySelector('#ansBody');
        const t0 = Date.now();
        while (Date.now() - t0 < 12000) {
          if (body.textContent && !/Looking that up/.test(body.textContent)) break;
          await new Promise(r => setTimeout(r, 60));
        }
        const sheet = document.querySelector('#answer');
        const chip = body.querySelector('[data-jump]');
        const id = chip?.getAttribute('data-jump') || null;
        return {
          theme: document.documentElement.dataset.theme,
          open: sheet.classList.contains('open'),
          sheetVisible: getComputedStyle(sheet).display !== 'none' && sheet.getBoundingClientRect().height > 40,
          q: document.querySelector('#ansQ').textContent,
          len: body.textContent.trim().length,
          stillSpinning: /Looking that up/.test(body.textContent),
          paragraphs: body.querySelectorAll('p, li').length,
          inkColour: getComputedStyle(body).color,
          chipId: id,
          chipLabel: chip?.textContent?.trim() || null,
          chipResolves: id ? SCENES.some(s => s.id === id) : null,
          chipHasIcon: chip ? Boolean(chip.querySelector('svg')) : null,
          waited: Date.now() - t0,
          // and it actually navigates
          jumped: await (async () => {
            if (!chip) return null;
            chip.click();
            await new Promise(r => setTimeout(r, 300));
            return { i: window.app.i, id: SCENES[window.app.i]?.id };
          })(),
        };
      }, theme);

      t.ok(r.open && r.sheetVisible && !r.stillSpinning,
        `§4 [${theme}] the answer sheet opened and RENDERED — not stuck on "Looking that up…"`,
        `${r.len} chars in ${r.waited}ms · ${r.paragraphs} block(s)`);
      t.ok(r.len > 400, `§4 [${theme}] a real, substantial answer landed`, `${r.len} chars`);
      t.ok(/governance/i.test(r.q), `§4 [${theme}] the sheet echoes the question asked`, JSON.stringify(r.q));
      t.ok(HEX.test(r.inkColour) || /^rgb/.test(r.inkColour),
        `§4 [${theme}] the sheet body is themed, not unstyled`, r.inkColour);
      t.ok(r.chipId && r.chipResolves === true,
        `§4 [${theme}] the jump chip resolves to a scene that EXISTS in scenes.js`,
        `data-jump="${r.chipId}" · label ${JSON.stringify(r.chipLabel)}`);
      t.ok(r.chipHasIcon === true,
        `§4 [${theme}] the chip wears its destination's DXC glyph`, `svg present: ${r.chipHasIcon}`);
      t.ok(r.jumped && r.jumped.id === r.chipId,
        `§4 [${theme}] clicking the chip actually navigates to that scene`,
        JSON.stringify(r.jumped));
      t.ok(errors.length === 0, `§4 [${theme}] no page errors across ask → render → jump`,
        JSON.stringify(errors.slice(0, 3)));
      await ctx.close();
    }

    /* ══ §5 THE THEME TOGGLE ROUND-TRIPS ═══════════════════════════════════
       Through localStorage, and it must survive a reload. The deliverable is
       opened from file://, so that is where it is tested — a pass on http://
       would prove nothing about the machine this ships to.

       The cold open has to be dismissed first, and that is not a detail: the
       overlay is modal and intercepts pointer events, so #themeBtn is genuinely
       unclickable until somebody deals with it. Correct — the click is what
       unlocks audio autoplay — but it means this section is testing the toggle
       as a VIEWER reaches it, which is the only way worth testing it. Skip
       rather than Start, so the deck is not narrating underneath the reload. */
    {
      const { page, errors, ctx } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });

      const gated = await page.evaluate(() => {
        const ov = document.querySelector('#overlay');
        const btn = document.querySelector('#themeBtn').getBoundingClientRect();
        const atBtn = document.elementFromPoint(btn.x + btn.width / 2, btn.y + btn.height / 2);
        return { overlayUp: Boolean(ov) && getComputedStyle(ov).display !== 'none', intercepted: atBtn?.id === 'overlay' || ov?.contains(atBtn) };
      });
      t.ok(gated.overlayUp && gated.intercepted,
        '§5 the cold open is genuinely modal — the chrome behind it is not clickable through it',
        JSON.stringify(gated));
      await dismissColdOpen(page);

      const start = await page.evaluate(async () => {
        await window.app.ready;
        let usable = false;
        try { localStorage.setItem('__probe', '1'); usable = localStorage.getItem('__probe') === '1'; localStorage.removeItem('__probe'); } catch {}
        return {
          theme: document.documentElement.dataset.theme,
          btn: document.querySelector('#themeBtn').textContent.trim(),
          localStorageUsable: usable,
          bg: getComputedStyle(document.body).backgroundColor,
        };
      });
      t.ok(start.theme === 'dark' && start.btn === 'Light',
        '§5 the deck ships on Midnight, and the button names the theme it switches TO',
        `data-theme=${start.theme} · button "${start.btn}"`);
      t.ok(start.localStorageUsable,
        '§5 localStorage is usable from file:// — the persistence path is real here, not stubbed',
        String(start.localStorageUsable));

      await page.click('#themeBtn');
      const after = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        btn: document.querySelector('#themeBtn').textContent.trim(),
        stored: (() => { try { return localStorage.getItem('aib-theme'); } catch { return 'THREW'; } })(),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      t.ok(after.theme === 'light' && after.btn === 'Dark',
        '§5 one click switches to Canvas and the button re-labels', `${after.theme} · "${after.btn}"`);
      t.ok(after.stored === 'light',
        '§5 the choice was WRITTEN to localStorage under the preserved `aib-theme` key',
        JSON.stringify(after.stored));
      t.ok(after.bg !== start.bg,
        '§5 and the PAGE repainted on the new ground — Canvas is a real theme, not a data attribute',
        `${start.bg} → ${after.bg}`);

      await page.reload({ waitUntil: 'load', timeout: BUDGET.canvas.load });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });
      const reloaded = await page.evaluate(async () => {
        await window.app.ready;
        return {
          theme: document.documentElement.dataset.theme,
          btn: document.querySelector('#themeBtn').textContent.trim(),
          stored: (() => { try { return localStorage.getItem('aib-theme'); } catch { return 'THREW'; } })(),
          sky: getComputedStyle(document.documentElement).getPropertyValue('--sky').trim(),
          apertureSky: window.app?.presenter?.backend?.avatar?.SKY || null,
        };
      });
      t.ok(reloaded.theme === 'light' && reloaded.stored === 'light',
        '§5 IT SURVIVED THE RELOAD — the deck came back up on Canvas',
        `data-theme=${reloaded.theme} · stored ${JSON.stringify(reloaded.stored)}`);
      t.ok(reloaded.btn === 'Dark', '§5 and the button came back labelled for the return trip', reloaded.btn);
      t.ok(reloaded.sky.toUpperCase() === '#004AAC' && String(reloaded.apertureSky).toUpperCase() === '#004AAC',
        '§5 and the APERTURE came up Royal too — it read the restored theme, not the default',
        `--sky ${reloaded.sky} · avatar.SKY ${reloaded.apertureSky}`);

      // and back again, so the round trip is a round trip. The cold open is
      // back up after the reload — it is part of every cold start — so it has
      // to be dealt with again before the chrome is reachable.
      await dismissColdOpen(page);
      await page.click('#themeBtn');
      const back = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        stored: (() => { try { return localStorage.getItem('aib-theme'); } catch { return 'THREW'; } })(),
      }));
      t.ok(back.theme === 'dark' && back.stored === 'dark',
        '§5 and back to Midnight — the toggle round-trips in both directions', JSON.stringify(back));
      t.ok(errors.length === 0, '§5 no page errors across toggle → reload → toggle',
        JSON.stringify(errors.slice(0, 3)));
      await ctx.close();
    }

    /* ══ §6 BOTH PRESENTERS, ALL TWELVE SCENES ═════════════════════════════
       autoadvance.test.mjs proves the deck DRIVES ITSELF to scene 12 on both
       targets. What it does not do is assert that each of the twelve scenes has
       something to narrate and that the presenter is asked to say it — a deck
       that advances through a silent scene passes there and fails the room.
       Both backends, because the two say() paths are entirely different code. */
    for (const [label, key, budget, wantBackend] of [
      ['index.html', 'canvas', BUDGET.canvas, 'canvas'],
      ['index-3d.html', 'three', BUDGET.three, 'talkinghead'],
    ]) {
      const { page, errors, ctx } = await openPage(browser, key, { budget });
      const info = await ready(page, budget);
      t.ok(info.backendKind === wantBackend,
        `§6 dist/${label}: the presenter on screen is the ${wantBackend} backend`, info.backendKind);

      const walk = await page.evaluate(async () => {
        const said = [];
        const p = window.app.presenter;
        const realSay = p.say.bind(p);
        p.say = (text, ...rest) => { said.push(String(text || '')); return realSay(text, ...rest); };
        const seen = [];
        for (let i = 0; i < SCENES.length; i++) {
          window.app.render(i, { play: false });
          await new Promise(r => setTimeout(r, 90));
          const cap = document.querySelector('#captionText');
          seen.push({
            i,
            id: SCENES[i].id,
            title: document.querySelector('#sceneTitle').textContent.trim(),
            lines: (SCENES[i].say || SCENES[i].lines || []).length || (SCENES[i].narration ? 1 : 0),
            stageHtml: document.querySelector('#stage').innerHTML.length,
            counter: document.querySelector('#sceneCounter').textContent.trim(),
            capClass: cap.className,
          });
        }
        return { seen, sceneCount: SCENES.length };
      });

      t.ok(walk.sceneCount === 12, `§6 dist/${label}: twelve scenes`, String(walk.sceneCount));
      const silent = walk.seen.filter(s => s.lines === 0);
      t.ok(silent.length === 0, `§6 dist/${label}: every one of the twelve scenes HAS narration to speak`,
        silent.length ? `silent: ${silent.map(s => `${s.i}:${s.id}`).join(', ')}`
          : walk.seen.map(s => `${s.id}=${s.lines}`).join(' · '));
      const empty = walk.seen.filter(s => s.stageHtml < 200);
      t.ok(empty.length === 0, `§6 dist/${label}: every scene rendered real markup onto the stage`,
        empty.length ? `thin: ${empty.map(s => `${s.id}=${s.stageHtml}B`).join(', ')}`
          : `smallest ${Math.min(...walk.seen.map(s => s.stageHtml))} B, largest ${Math.max(...walk.seen.map(s => s.stageHtml))} B`);
      const badCounter = walk.seen.filter((s, i) => s.counter !== `scene ${i + 1} / 12`);
      t.ok(badCounter.length === 0, `§6 dist/${label}: the counter tracked all twelve`,
        badCounter.length ? JSON.stringify(badCounter.slice(0, 3)) : 'scene 1 / 12 … scene 12 / 12');

      /* And every scene's own opening line pushed through THIS backend, end to
         end — twelve real lines, twelve real say() calls.

         Timing is deliberately NOT the assertion. With no key, the canvas path
         ends in voice.speakBrowser(), and a headless box with no installed
         speech-synthesis voice resolves that instantly — so a duration check
         here measures the BOX, not the deck, and would be indistinguishable
         from a real stall. What is asserted instead is the wiring: the backend
         was handed each line, with a duration estimated from the text, and the
         presenter's state machine came back to idle without hanging. */
      const narration = await page.evaluate(async () => {
        const p = window.app.presenter;
        const got = [];
        const realSpeak = p.backend.speak.bind(p.backend);
        p.backend.speak = (text, ms, clip) => { got.push({ text: String(text || ''), ms }); return realSpeak(text, ms, clip); };
        const states = [];
        for (let i = 0; i < SCENES.length; i++) {
          window.app.render(i, { play: false });
          await new Promise(r => setTimeout(r, 40));
          await p.say(SCENES[i].lines[0]);
          states.push(p.state);
        }
        p.backend.speak = realSpeak;
        return { got, states, wanted: SCENES.map(s => s.lines[0]) };
      });
      const delivered = narration.wanted.filter((w, i) => narration.got[i]?.text === w);
      t.ok(delivered.length === 12,
        `§6 dist/${label}: all twelve scenes NARRATED through this backend — each line reached backend.speak()`,
        `${delivered.length}/12 lines delivered verbatim`);
      const durations = narration.got.map(g => g.ms).filter(Number.isFinite);
      t.ok(durations.length === 12 && durations.every(d => d > 1000),
        `§6 dist/${label}: each line carried a real duration estimated from its own text`,
        `${Math.min(...durations)}–${Math.max(...durations)} ms across ${durations.length} lines`);
      t.ok(narration.states.every(s => s === 'idle'),
        `§6 dist/${label}: the presenter settled back to idle after every line — nothing hung`,
        [...new Set(narration.states)].join(', '));
      t.ok(errors.length === 0, `§6 dist/${label}: no page errors across all twelve scenes`,
        JSON.stringify(errors.slice(0, 3)));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  /* ══ §7 ZERO EMOJI IN ANY BUILT TARGET ═══════════════════════════════════ */
  {
    let totalScanned = 0;
    for (const [label, out] of [['index.html', canvas], ['artifact.html', artifact], ['index-3d.html', three]]) {
      const hits = [...out.matchAll(EMOJI)];
      totalScanned += out.length;
      const sample = hits.slice(0, 5).map(m => {
        const cp = [...m[0]].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ');
        return `${JSON.stringify(m[0])} ${cp} @${m.index} ctx=${JSON.stringify(out.slice(Math.max(0, m.index - 40), m.index + 20))}`;
      });
      t.ok(hits.length === 0, `§7 dist/${label} contains ZERO emoji / pictographic codepoints`,
        hits.length ? `${hits.length} hit(s): ${sample.join(' | ')}` : `${out.length.toLocaleString()} chars scanned, clean`);
    }
    // positive control: the scanner can see an emoji when there is one.
    t.ok([...'a ✈ b'.matchAll(EMOJI)].length === 1 && [...'a 🛬 b'.matchAll(EMOJI)].length === 1,
      '§7 positive control: the scanner DOES match an emoji when one is present',
      `${totalScanned.toLocaleString()} chars scanned across three targets`);
  }
}
