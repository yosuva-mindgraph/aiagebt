#!/usr/bin/env node
/* ============================================================================
   Look at it.

   Drives a real browser through dist/index.html at 1920x1080 and 1440x900,
   captures every scene, and reports horizontal overflow and page errors — the
   two faults a screenshot alone will not tell you about.

   This exists because reasoning about a layout is not the same as seeing it.

       node shoot.js                 all scenes, both sizes
       node shoot.js --scene live    one scene
       node shoot.js --open          keep the browser open

   Output lands in shots/ (gitignored).
   ========================================================================== */

const path = require('path');
const fs = require('fs');

const PW = process.env.AIB_PLAYWRIGHT
  || '/home/mindgraph1/projects/dxcaib/aibgames-gen/node_modules/playwright';
const { chromium } = require(PW);

const ROOT = __dirname;
const FILE = 'file://' + path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(ROOT, 'shots');

const SIZES = [
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
];

const argScene = (() => {
  const i = process.argv.indexOf('--scene');
  return i > -1 ? process.argv[i + 1] : null;
})();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];

  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`[${size.name}] page error: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`[${size.name}] console: ${m.text()}`); });

    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // cold open
    await page.screenshot({ path: path.join(OUT, `${size.name}-00-open.png`) });

    // start, but silence the voice so the run is fast and deterministic
    await page.evaluate(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
    await page.click('#skipIntroBtn');
    await page.waitForTimeout(300);

    const scenes = await page.evaluate(() =>
      [...document.querySelectorAll('#sceneList .strip-item')].map((b, i) => ({ i, t: b.querySelector('.t').textContent })));

    for (const s of scenes) {
      await page.evaluate(i => window.app.render(i, { play: false }), s.i);
      await page.waitForTimeout(420);

      const id = await page.evaluate(() => window.app && document.querySelector('#sceneTitle').textContent);
      if (argScene && !String(id).toLowerCase().includes(argScene.toLowerCase())) continue;

      const slug = String(s.t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await page.screenshot({ path: path.join(OUT, `${size.name}-${String(s.i + 1).padStart(2, '0')}-${slug}.png`) });

      const overflow = await page.evaluate(() => ({
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stage: (() => { const el = document.querySelector('#stage'); return el.scrollWidth - el.clientWidth; })(),
      }));
      if (overflow.body > 1) problems.push(`[${size.name}] "${s.t}" — page scrolls sideways by ${overflow.body}px`);
      if (overflow.stage > 1) problems.push(`[${size.name}] "${s.t}" — stage overflows by ${overflow.stage}px`);
    }

    // the answer sheet, on a real question
    await page.evaluate(() => window.app.handleAsk('How do you stop an AI agent seeing data it should not see?'));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${size.name}-99-answer.png`) });

    if (!process.argv.includes('--open')) await ctx.close();
  }

  if (!process.argv.includes('--open')) await browser.close();

  const shots = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length;
  console.log(`${shots} shots → shots/`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach(p => console.log('  ✗ ' + p));
    process.exit(1);
  }
  console.log('no overflow, no page errors.');
})();
