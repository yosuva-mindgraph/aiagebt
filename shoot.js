#!/usr/bin/env node
/* ============================================================================
   Look at it.

   Drives a real browser through a built target at 1920x1080 and 1440x900,
   captures every scene, and reports horizontal overflow and page errors — the
   two faults a screenshot alone will not tell you about.

   This exists because reasoning about a layout is not the same as seeing it.

       node shoot.js                 all scenes, both sizes   (dist/index.html)
       node shoot.js --3d            the same, against dist/index-3d.html
       node shoot.js --scene live    one scene
       node shoot.js --open          keep the browser open

   Output lands in shots/ (gitignored). --3d writes shots/3d-* so a canvas run
   and a 3D run can sit side by side without overwriting each other. Each run
   DELETES its own prefix first: a stale PNG that survives a failed run is a
   screenshot of a page nobody looked at, and the tally at the bottom would
   count it.

   ── the default target stays the CANVAS one, deliberately ─────────────────
   dist/index.html is the deliverable and it shoots in about twenty seconds.
   dist/index-3d.html is a 10 MB file that has to parse, spin up a WebGL context
   on SwiftShader and load a 6.5 MB rigged GLB before it paints — minutes, not
   seconds, on this box. Making that the default would turn the fast gate into a
   slow one, so --3d opts in and gets its own, much longer budget instead. A
   single set of timeouts cannot serve both: generous enough for software WebGL
   is generous enough to hide a real hang in the canvas build.

   ── what this gate CANNOT see, and what covers it ─────────────────────────
   It drives the deck with `window.app.render(i, { play: false })` — it walks the
   scenes itself, because it is photographing them. That is the right design for
   a layout gate and it is precisely why it is blind to the transport: it never
   asks the deck to move on its OWN. A build that renders all twelve scenes
   perfectly and then refuses to advance past scene 2 passes this file cleanly —
   which is exactly what shipped. Auto-advance, cancellation, the offline
   promise and the avatar's morph geometry are covered in tests/ instead:

       node tests/run.mjs

   ── headless Chromium here has no emoji font ──────────────────────────────
   The scene-2 chooser icons therefore render as tofu boxes in every shot. That
   is a missing font on the test box, not a fault in the deck; nothing here
   inspects glyph coverage and nothing here should.
   ========================================================================== */

const path = require('path');
const fs = require('fs');

const PW = process.env.AIB_PLAYWRIGHT
  || '/home/mindgraph1/projects/dxcaib/aibgames-gen/node_modules/playwright';
const { chromium } = require(PW);

const ROOT = __dirname;
const OUT = path.join(ROOT, 'shots');

const WANT_3D = process.argv.includes('--3d');

/* Two targets, two budgets. The 3D numbers are not padding for its own sake:
   loading the avatar alone measures in the hundreds of milliseconds on a GPU and
   in the tens of seconds on SwiftShader, and the per-scene settle has to cover a
   software render loop rather than a 2D canvas. */
const TARGET = WANT_3D
  ? {
    file: 'dist/index-3d.html',
    prefix: '3d-',
    label: '3D presenter (TalkingHead)',
    goto: 120000,    // 10 MB of HTML to parse before anything runs
    ready: 120000,   // WebGL context + a 6.5 MB rigged GLB, on SwiftShader
    settle: 1400,    // per scene, after render() — a software render loop
    answer: 4000,
  }
  : {
    file: 'dist/index.html',
    prefix: '',
    label: 'canvas presenter',
    goto: 30000,
    ready: 15000,
    settle: 420,
    answer: 700,
  };

const FILE = 'file://' + path.join(ROOT, TARGET.file);

/* The deck is twelve scenes; index.html's strip head says "scene 1 / 12" in
   markup for the same reason. If a scene is ever added, this number and that
   string both move — deliberately, together. */
const EXPECTED_SCENES = 12;

/* ONE predicate, used by both the pre-run clean and the post-run count, so the
   two can never disagree about which files belong to this run. The canvas
   target's prefix is the empty string, which every filename starts with, so it
   has to exclude the 3D run's shots explicitly. */
const mine = f => f.endsWith('.png') && f.startsWith(TARGET.prefix)
  && (TARGET.prefix || !f.startsWith('3d-'));

const SIZES = [
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
];

const argScene = (() => {
  const i = process.argv.indexOf('--scene');
  return i > -1 ? process.argv[i + 1] : null;
})();

(async () => {
  if (!fs.existsSync(path.join(ROOT, TARGET.file))) {
    console.error(`shoot.js: ${TARGET.file} is not built.`);
    console.error(WANT_3D ? '  build it with:  node build.js --3d' : '  build it with:  node build.js');
    process.exit(1);
  }

  /* Clean this target's shots BEFORE shooting, not after. mkdirSync alone left
     the previous run's PNGs on disk, so the count printed at the end could be
     satisfied entirely by stale files: a run that photographed NOTHING still
     reported "28 shots → shots/*" and exited 0. Every PNG under shots/ after
     this line was taken by THIS run. */
  fs.mkdirSync(OUT, { recursive: true });
  const stale = fs.readdirSync(OUT).filter(mine);
  stale.forEach(f => fs.rmSync(path.join(OUT, f), { force: true }));
  if (stale.length) console.log(`cleared ${stale.length} shot(s) from the previous run`);

  const browser = await chromium.launch();
  const problems = [];
  let taken = 0;   // counted here, not read off the directory — see the tally below
  console.log(`shooting ${TARGET.file} — ${TARGET.label}`);

  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`[${size.name}] page error: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`[${size.name}] console: ${m.text()}`); });

    await page.goto(FILE, { waitUntil: 'load', timeout: TARGET.goto });

    /* Wait for the presenter to have ATTACHED rather than for a fixed pause.
       On the 3D target that is a WebGL context and a multi-megabyte GLB, and a
       fixed wait would either photograph an empty rail or bore everyone on the
       canvas build. Report which backend actually came up — a 3D run that
       quietly fell back to the canvas bust is a shoot of the wrong thing. */
    await page.waitForFunction(() => Boolean(window.app), null, { timeout: TARGET.ready });
    const backend = await page.evaluate(async () => {
      await window.app.ready;
      return window.app.presenter.backendKind;
    });
    if (WANT_3D && backend !== 'talkinghead') {
      problems.push(`[${size.name}] --3d fell back to the "${backend}" backend — this is not a shoot of the 3D presenter`);
    }
    console.log(`  [${size.name}] backend: ${backend}`);
    await page.waitForTimeout(TARGET.settle);

    // cold open
    await page.screenshot({ path: path.join(OUT, `${TARGET.prefix}${size.name}-00-open.png`) }); taken++;

    // start, but silence the voice so the run is fast and deterministic
    await page.evaluate(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
    await page.click('#skipIntroBtn');
    await page.waitForTimeout(300);

    /* ── the gate's own load-bearing assumption, checked out loud ─────────
       These two CSS classes are the only class-name selectors in the whole
       automated gate, and they are written in src/app.js by _buildStrip(). A
       brand pass that renames either one USED TO END THE RUN SILENTLY:

         .strip-item renamed → querySelectorAll returns []; the per-scene loop
           below never runs, so ZERO screenshots are taken and ZERO overflow
           checks happen; `problems` stays empty and this file prints "no
           overflow, no page errors" and exits 0.
         .t renamed → b.querySelector('.t') is null and .textContent threw
           inside page.evaluate — red, but as an unhandled rejection with a
           stack pointing at this file rather than at the renamed class.

       So the titles are read null-safely and the shape is ASSERTED instead:
       one strip item per scene, each with a readable title. A visual gate that
       cannot photograph anything must say so, not congratulate itself. */
    const strip = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#sceneList .strip-item')];
      return {
        titles: items.map(b => {
          const el = b.querySelector('.t');
          return el ? el.textContent : null;
        }),
        declared: typeof SCENES !== 'undefined' ? SCENES.length : null,
      };
    });

    const blind = [];
    if (strip.titles.length !== EXPECTED_SCENES) {
      blind.push(`'#sceneList .strip-item' matched ${strip.titles.length} element(s), expected ${EXPECTED_SCENES}`
        + ` (the deck declares ${strip.declared} scenes) — renamed class, or the strip never built`);
    }
    const untitled = strip.titles.filter(t => t === null).length;
    if (untitled) {
      blind.push(`${untitled} strip item(s) have no '.t' title element — renamed class in src/app.js _buildStrip()`);
    }
    if (blind.length) {
      console.error('\nshoot.js: the scene strip is unreadable, so no scene can be photographed'
        + ' or checked for overflow.');
      blind.forEach(b => console.error('  ✗ ' + b));
      console.error('  Fix the selectors in shoot.js to match src/app.js, or fix the strip.');
      await browser.close();
      process.exit(1);
    }

    const scenes = strip.titles.map((t, i) => ({ i, t }));

    for (const s of scenes) {
      await page.evaluate(i => window.app.render(i, { play: false }), s.i);
      await page.waitForTimeout(TARGET.settle);

      const id = await page.evaluate(() => window.app && document.querySelector('#sceneTitle').textContent);
      if (argScene && !String(id).toLowerCase().includes(argScene.toLowerCase())) continue;

      const slug = String(s.t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await page.screenshot({ path: path.join(OUT, `${TARGET.prefix}${size.name}-${String(s.i + 1).padStart(2, '0')}-${slug}.png`) }); taken++;

      const overflow = await page.evaluate(() => ({
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stage: (() => { const el = document.querySelector('#stage'); return el.scrollWidth - el.clientWidth; })(),
      }));
      if (overflow.body > 1) problems.push(`[${size.name}] "${s.t}" — page scrolls sideways by ${overflow.body}px`);
      if (overflow.stage > 1) problems.push(`[${size.name}] "${s.t}" — stage overflows by ${overflow.stage}px`);
    }

    // the answer sheet, on a real question
    await page.evaluate(() => window.app.handleAsk('How do you stop an AI agent seeing data it should not see?'));
    await page.waitForTimeout(TARGET.answer);
    await page.screenshot({ path: path.join(OUT, `${TARGET.prefix}${size.name}-99-answer.png`) }); taken++;

    if (!process.argv.includes('--open')) await ctx.close();
  }

  if (!process.argv.includes('--open')) await browser.close();

  /* The tally is now an assertion rather than a remark. shots/ was emptied of
     this target's PNGs at the start, so the two numbers have to agree: what the
     run believes it photographed, and what is actually on disk. And with no
     --scene filter the full set is knowable — one cold open, twelve scenes and
     one answer sheet, at each of the two sizes. */
  const shots = fs.readdirSync(OUT).filter(mine).length;
  console.log(`${shots} shots → shots/${TARGET.prefix}*`);
  if (shots !== taken) {
    problems.push(`took ${taken} screenshot(s) but shots/${TARGET.prefix}* holds ${shots} — the directory was not clean`);
  }
  if (!argScene) {
    const want = SIZES.length * (EXPECTED_SCENES + 2);
    if (taken !== want) problems.push(`took ${taken} screenshot(s), expected ${want} (${SIZES.length} sizes × ${EXPECTED_SCENES} scenes + open + answer)`);
  }
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach(p => console.log('  ✗ ' + p));
    process.exit(1);
  }
  console.log('no overflow, no page errors.');
})();
