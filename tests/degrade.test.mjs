/* ============================================================================
   DEGRADATION — the machine this actually runs on.

   The 3D presenter is the upside. The deliverable is what happens when it is not
   available, and there are four ordinary ways for that to be true:

     1. the file simply has no TalkingHead in it        → dist/index.html
     2. the GPU is blocklisted, so getContext('webgl') returns null
     3. the viewer asked for prefers-reduced-motion
     4. the rail is display:none, so the mount measures 0x0 (phone width)

   In every one of them the contract is identical and is not "it does not crash":
   the canvas bust presents, Web Speech narrates, ALL TWELVE SCENES run, and
   questions are still answered. Falling back is not an error state — it is the
   path that ships — so this suite also requires that nothing is logged as an
   error while it happens.

   Cases 2-4 are all run against dist/index-3d.html, on purpose: that is the file
   that HAS the 3D presenter, so it is the only place where choosing not to use
   it means anything. Running them against the canvas build would prove that a
   file with no TalkingHead in it does not use TalkingHead.

   ── one thing this suite deliberately does NOT fail on ────────────────────
   Headless Chromium here has no emoji font, so the scene-2 chooser icons render
   as tofu boxes. That is a font that is missing from the test box, not a fault
   in the deck, and nothing below looks at glyph coverage.
   ========================================================================== */

import { launch, openPage, ready, BUDGET, KILL_WEBGL, fileUrl } from './lib/harness.mjs';

/** Walk the whole deck, hands off, and then ask something. */
async function fullRun(t, page, budget, label) {
  await page.click('#startBtn');
  let reached = true;
  try {
    await page.waitForFunction(() => window.app.i >= 11, null, { timeout: budget.deck, polling: 100 });
  } catch { reached = false; }
  const at = await page.evaluate(() => ({
    i: window.app.i, counter: document.querySelector('#sceneCounter').textContent, seen: window.app.seen.size,
  }));
  t.ok(reached, `${label}: all twelve scenes narrate with no GPU`, `reached ${at.counter}, ${at.seen} seen`);

  const ask = await page.evaluate(async () => {
    window.app.handleAsk('How do you stop an AI agent seeing data it should not see?');
    for (let i = 0; i < 150; i++) {
      const html = document.querySelector('#ansBody').innerHTML;
      if (html && !/Looking that up/.test(html)) return { ok: true, text: document.querySelector('#ansBody').textContent.trim().slice(0, 100) };
      await new Promise(r => setTimeout(r, 100));
    }
    return { ok: false };
  });
  t.ok(ask.ok, `${label}: questions are still answered`, JSON.stringify(ask.text || ''));
}

export async function run(t) {
  const browser = await launch();
  try {
    /* ── 1. no WebGL at all, on the file that HAS the 3D presenter ─────── */
    {
      const budget = BUDGET.canvas;   // with 3D declined, this runs at canvas speed
      const { page, errors, external, warnings } = await openPage(browser, 'three', {
        budget: BUDGET.three, initScript: KILL_WEBGL,
      });
      const info = await ready(page, BUDGET.three);
      t.ok(info.backendKind === 'canvas',
        'no WebGL → dist/index-3d.html falls back to the canvas bust', `backend=${info.backendKind}`);
      t.ok(warnings.some(w => /3D presenter unavailable/.test(w)),
        'and says so ONCE, as a warning — falling back is a fact, not a fault',
        (warnings.find(w => /3D presenter unavailable/.test(w)) || '(nothing logged)').slice(0, 120));
      t.ok(!errors.some(e => /avatar|webgl|talkinghead/i.test(e)),
        'nothing is logged as an ERROR while falling back', JSON.stringify(errors.slice(0, 2)));

      // the mount must go back out of the way, or an empty box sits on the bust
      const layout = await page.evaluate(() => ({
        mountHidden: document.querySelector('#avatar3d').hidden,
        canvasShown: getComputedStyle(document.querySelector('#avatar')).display !== 'none',
        mountChildren: document.querySelector('#avatar3d').children.length,
      }));
      t.ok(layout.mountHidden && layout.canvasShown && layout.mountChildren === 0,
        'exactly one presenter is on screen: the empty 3D mount is hidden again',
        JSON.stringify(layout));

      await fullRun(t, page, budget, 'no-WebGL');
      t.ok(external.length === 0, 'no-WebGL: still zero network requests',
        external.slice(0, 3).join(' , '));
      t.eq(errors, [], 'no-WebGL: no page errors across the whole degraded run');
      await page.context().close();
    }

    /* ── 2. the viewer asked for less motion ───────────────────────────── */
    {
      const ctx = await browser.newContext({
        viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 200)); });
      await page.goto(fileUrl('dist/index-3d.html'), { waitUntil: 'load', timeout: BUDGET.three.load });
      await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.three.attach });
      const kind = await page.evaluate(async () => { await window.app.ready; return window.app.presenter.backendKind; });
      t.ok(kind === 'canvas', 'prefers-reduced-motion: reduce → the canvas bust, not a spinning head', `backend=${kind}`);
      t.eq(errors, [], 'prefers-reduced-motion: no page errors');
      await ctx.close();
    }

    /* ── 3. a phone, where #rail is display:none and the mount is 0x0 ─── */
    {
      const { page, errors } = await openPage(browser, 'three', {
        budget: BUDGET.three, viewport: { width: 390, height: 844 },
      });
      const kind = await page.evaluate(async () => { await window.app.ready; return window.app.presenter.backendKind; });
      t.ok(kind === 'canvas',
        'a 0x0 mount declines rather than paying for an invisible WebGL context', `backend=${kind}`);
      t.eq(errors, [], 'narrow viewport: no page errors');
      await page.context().close();
    }

    /* ── 4. the viewer who would rather read ───────────────────────────
       The cold open says "Use the toggle in the top right if you'd rather
       read", so muting mid-walkthrough is an advertised path, not an edge case.
       It is also structurally the same hazard as the scene-2 stall: setMuted()
       calls cancel(), which resolves the line in flight — and if the narration
       loop treated that as "the line ended early" wrongly, or as "stop", the
       deck would either sprint or freeze. Assert it keeps walking, and that the
       captions keep turning over so there is still something to READ. */
    {
      const { page, errors } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
      await ready(page, BUDGET.canvas);
      await page.click('#startBtn');
      await page.waitForFunction(() => window.app.i >= 1, null, { timeout: BUDGET.canvas.deck, polling: 100 });

      /* A muted run is SLOWER here, not faster, and that is worth knowing before
         tuning this window: unmuted, headless Web Speech has no voices and fires
         onerror in about a millisecond, so a line costs nothing. Muted,
         Presenter._speak takes a deliberate beat of estimate(text) * 0.35 so the
         deck still reads as a walkthrough rather than a slideshow — real
         seconds, per line. One full scene boundary crossed on its own is the
         assertion; racing to scene 12 is somebody else's test. */
      const r = await page.evaluate(async () => {
        document.querySelector('#muteBtn').click();       // "I'd rather read"
        const from = window.app.i;
        const captions = new Set();
        const t0 = performance.now();
        while (performance.now() - t0 < 40000 && window.app.i < from + 2) {
          captions.add(document.querySelector('#captionText').textContent);
          await new Promise(r2 => setTimeout(r2, 120));
        }
        return {
          muted: window.app.muted, from, to: window.app.i,
          playing: window.app.playing, captions: captions.size,
          label: document.querySelector('#muteBtn').textContent,
        };
      });
      t.ok(r.muted && /Sound off/.test(r.label), 'the mute toggle reports itself muted', JSON.stringify(r.label));
      t.ok(r.to > r.from && r.playing,
        'muting does not stall the walkthrough — it crosses a scene boundary on its own and stays playing',
        `scene ${r.from + 1} → ${r.to + 1} while muted, playing=${r.playing}`);
      t.ok(r.captions >= 4, 'and the captions keep turning over, so there is something to read',
        `${r.captions} distinct captions`);
      t.eq(errors, [], 'muted run: no page errors');
      await page.context().close();
    }

    /* ── 5. and the deliverable itself, which has no 3D in it at all ──── */
    {
      const { page, errors } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
      const probe = await page.evaluate(async () => {
        await window.app.ready;
        return {
          kind: window.app.presenter.backendKind,
          hasTalkingHead: typeof window.TalkingHead,
          hasGlb: typeof window.AIB_AVATAR_GLB_B64,
          usingElevenLabs: window.app.voice.usingElevenLabs,
        };
      });
      t.eq(probe, { kind: 'canvas', hasTalkingHead: 'undefined', hasGlb: 'undefined', usingElevenLabs: false },
        'dist/index.html: no key, no vendor, no GLB — canvas bust and Web Speech');
      t.eq(errors, [], 'dist/index.html: no page errors');
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
}
