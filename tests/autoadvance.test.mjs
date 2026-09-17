/* ============================================================================
   THE ONE THAT SHIPPED.

   A customer-facing artifact went out that never advanced past scene 2. It
   looked fine: the film strip moved, the counter read "scene 2 / 12", the
   transport button read "⏸ Pause presentation". It was simply silent, forever,
   and stayed that way until somebody pressed Skip.

       play()  →  if (this.playing) return;            // the guard
         …last line…
         render(this.i + 1, { play: true })            // its own tail
           →  play()                                   // and here it returns

   render() bumps this.token, so the old narration loop is already dead — but it
   did not clear this.playing, so the guard swallowed the new one. A scene change
   is not a second loop; it IS the loop moving on.

   ── WHY shoot.js COULD NOT CATCH THIS ─────────────────────────────────────
   shoot.js drives the deck with `window.app.render(i, { play: false })` — it
   walks the scenes itself, to photograph them. That is the right design for a
   layout gate and it is exactly why it is blind here: auto-advance is the one
   transition it never asks for. The deck was photographed twelve times, in two
   viewports, and never once asked to move on its own.

   So this suite touches ONE control — #startBtn — and then does not touch the
   page again. Everything after that must happen by itself.

   ── the negative control ──────────────────────────────────────────────────
   A regression test that has never been seen to go red is a decoration. The
   last block here runs this same probe against `git show master:dist/index.html`
   — the artifact with the bug in it — and requires it to STALL. If master ever
   passes, this file is broken, not fixed.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { launch, openPage, ready, BUDGET, ROOT } from './lib/harness.mjs';

/* Sample the transport 25x a second and keep only the CHANGES. The result is a
   readable trace of what the deck did while nobody was touching it — which is
   also the evidence a failure needs to be believed. */
const RECORDER = `
  window.__trace = [];
  window.__rec = setInterval(() => {
    const st = document.querySelector('#avatarState');
    const s = {
      t: Math.round(performance.now()),
      i: window.app ? window.app.i : -1,
      counter: document.querySelector('#sceneCounter').textContent,
      state: st ? st.dataset.state : '?',
      playing: window.app ? window.app.playing : null,
      btn: document.querySelector('#playBtn').textContent.replace(/[^A-Za-z ]/g, '').trim(),
    };
    const last = window.__trace[window.__trace.length - 1];
    if (!last || last.i !== s.i || last.state !== s.state || last.playing !== s.playing || last.btn !== s.btn) {
      window.__trace.push(s);
    }
  }, 40);
`;

/**
 * Press start, then keep hands off. Resolves with the trace.
 * `stopAt` is the scene index we are waiting to see reached (11 = scene 12).
 */
async function driveDeck(page, budget, { stopAt = 11, timeout } = {}) {
  await page.evaluate(RECORDER);
  const t0 = Date.now();
  await page.click('#startBtn');

  // The ONLY thing this waits on is the deck doing it by itself.
  let reached = true;
  try {
    await page.waitForFunction(
      target => window.app && window.app.i >= target,
      stopAt,
      { timeout: timeout || budget.deck, polling: 100 },
    );
  } catch { reached = false; }

  /* Reaching scene 12 is not the end of the deck — scene 12 still has five
     lines to narrate, and only when they run out does play() fall through to
     pause(). Wait for THAT rather than for a fixed number of milliseconds:
     software WebGL makes the 3D target about 4x slower per line, and a settle
     window tuned on the canvas build would read its final scene as a stall. */
  let settled = true;
  if (reached) {
    try {
      await page.waitForFunction(() => window.app.playing === false, null,
        { timeout: Math.round((timeout || budget.deck) / 2), polling: 200 });
    } catch { settled = false; }
    await page.waitForTimeout(500);
  }
  const trace = await page.evaluate(() => { clearInterval(window.__rec); return window.__trace; });
  const final = await page.evaluate(() => ({
    i: window.app.i,
    playing: window.app.playing,
    counter: document.querySelector('#sceneCounter').textContent,
    btn: document.querySelector('#playBtn').textContent,
    caption: document.querySelector('#captionText').textContent,
    seen: window.app.seen.size,
  }));
  return { reached, settled, trace, final, ms: Date.now() - t0 };
}

/** Everything worth asserting, derived from the trace. */
function summarise(trace) {
  const visited = [];
  for (const s of trace) if (visited[visited.length - 1] !== s.i) visited.push(s.i);
  const spokeIn = new Set(trace.filter(s => s.state === 'speaking').map(s => s.i));
  // The exact shape of the shipped bug: playing === true, nothing speaking.
  let worstStall = 0, stallAt = null;
  for (let k = 1; k < trace.length; k++) {
    const prev = trace[k - 1];
    if (prev.playing === true && prev.state !== 'speaking') {
      const gap = trace[k].t - prev.t;
      if (gap > worstStall) { worstStall = gap; stallAt = prev.i; }
    }
  }
  return { visited, spokeIn, worstStall, stallAt };
}

async function checkTarget(t, browser, target, budget, label) {
  const { page, errors } = await openPage(browser, target, { budget });
  const info = await ready(page, budget);
  t.note(`${label}: backend=${info.backendKind}, ${info.scenes} scenes`);

  const { reached, settled, trace, final, ms } = await driveDeck(page, budget);
  const { visited, spokeIn, worstStall, stallAt } = summarise(trace);

  t.ok(reached, `${label}: the deck reached SCENE 12 on its own after one click on #startBtn`,
    `got to "${final.counter}" in ${(ms / 1000).toFixed(1)}s`);

  t.eq(visited, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    `${label}: it visited all twelve scenes, in order, unassisted`);

  // The bug was NOT "it did not move" — the strip moved. It was "it went quiet".
  const silent = visited.filter(i => !spokeIn.has(i));
  t.ok(silent.length === 0,
    `${label}: every scene it reached actually NARRATED (avatarState hit 'speaking')`,
    silent.length ? `silent scenes: ${silent.map(i => i + 1).join(',')}` : `12/12 spoke`);

  t.ok(worstStall < 10000,
    `${label}: never sat with playing=true and nothing speaking`,
    `longest such gap ${worstStall} ms${stallAt === null ? '' : ` (scene ${stallAt + 1})`}`);

  // Specifically scene 2 → scene 3, because that is the edge it died on.
  const twoToThree = visited.indexOf(1) > -1 && visited.indexOf(2) > visited.indexOf(1);
  t.ok(twoToThree, `${label}: crossed scene 2 → scene 3 (the edge master died on)`);

  /* The end of the deck is the OTHER half of the same flag. play() falls out of
     the loop into pause() on the last scene; if that is wrong the button lies in
     the opposite direction. */
  t.ok(settled && final.playing === false,
    `${label}: the last scene narrates out and playing goes false`,
    `settled=${settled} playing=${final.playing} after ${(ms / 1000).toFixed(1)}s`);
  t.ok(/Resume presentation/.test(final.btn),
    `${label}: the button stops claiming to be able to pause`, JSON.stringify(final.btn));
  t.ok(/Ask me anything/.test(final.caption),
    `${label}: the closing line is on screen`, JSON.stringify(final.caption.slice(0, 60)));
  t.ok(final.seen === 12, `${label}: all 12 scenes marked seen`, String(final.seen));
  t.eq(errors, [], `${label}: no page errors across the whole run`);

  await page.context().close();
  return trace;
}

export async function run(t) {
  const browser = await launch();
  try {
    /* ── the deliverable ────────────────────────────────────────────────── */
    const trace = await checkTarget(t, browser, 'canvas', BUDGET.canvas, 'dist/index.html');
    t.note(`trace: ${trace.length} transport changes recorded`);

    /* ── and the 3D build, which has a whole extra backend to stall in ──── */
    await checkTarget(t, browser, 'three', BUDGET.three, 'dist/index-3d.html');

    /* ── NEGATIVE CONTROL: the same probe must FAIL on master ───────────── */
    const tmp = path.join(os.tmpdir(), `aib-master-baseline-${process.pid}.html`);
    let haveBaseline = true;
    try {
      fs.writeFileSync(tmp, execFileSync('git', ['show', 'master:dist/index.html'],
        { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
    } catch (err) {
      haveBaseline = false;
      t.ok(false, 'could not read master:dist/index.html for the negative control',
        String(err?.message || err).slice(0, 200));
    }

    if (haveBaseline) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      await page.goto('file://' + tmp, { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });
      await page.evaluate(async () => { await window.app.ready; });

      // 60s is ~6x what the fixed deck needs to walk all twelve scenes here.
      const r = await driveDeck(page, BUDGET.canvas, { timeout: 60000 });
      const s = summarise(r.trace);
      t.ok(!r.reached,
        'NEGATIVE CONTROL: master:dist/index.html does NOT reach scene 12 — this probe has teeth',
        `master stalled at "${r.final.counter}" after 60s, having visited ${JSON.stringify(s.visited.map(i => i + 1))}`);
      t.ok(r.final.playing === true && /Pause presentation/.test(r.final.btn),
        'NEGATIVE CONTROL: and it stalls in exactly the reported state — playing:true, button "Pause presentation", silent',
        `playing=${r.final.playing} btn=${JSON.stringify(r.final.btn)} state-silent-for=${s.worstStall}ms`);
      await ctx.close();
      fs.rmSync(tmp, { force: true });
    }
  } finally {
    await browser.close();
  }
}
