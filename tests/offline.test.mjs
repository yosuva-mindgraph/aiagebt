/* ============================================================================
   THE OFFLINE PROMISE, INTERCEPTED RATHER THAN INFERRED.

   "No keys, no GPU, no network" is the product. The network half is the easiest
   to believe and the easiest to get wrong, because everything that would break
   it degrades quietly: a font that falls back, a fetch that fails and is caught,
   a GLB that 404s into the canvas bust. On a booth machine with the cable out,
   every one of those is invisible until somebody notices the deck looks wrong.

   So this does not read config, and it does not grep for 'https'. Every request
   the page makes is ROUTED. Anything that is not file:/data:/blob:/about: is
   recorded by URL and ABORTED — the page is genuinely unable to reach the
   network, exactly as the booth machine is, and a request that tried is a named
   failure rather than a silent fallback.

   The interceptor is proved before it is trusted: the first check makes the page
   attempt a real fetch and requires it to be caught and blocked. A "zero
   external requests" result from a route that is not wired would otherwise be
   the most reassuring possible way to learn nothing.

   All three targets are tested, from file://, and each one is EXERCISED — cold
   open, two scenes of narration, a question answered — because a deck that
   reaches for the network does it while it is working, not while it is idle.
   ========================================================================== */

import { launch, openPage, ready, BUDGET } from './lib/harness.mjs';
import { KB, DONT_KNOW } from '../src/knowledge.js';
import { GROUNDED } from './lib/probes.mjs';

async function exercise(page, budget, { hasTransport = true } = {}) {
  if (hasTransport) {
    await page.click('#startBtn');
    // two scenes' worth of narration, on its own clock
    await page.waitForFunction(() => window.app && window.app.i >= 2, null,
      { timeout: budget.deck, polling: 100 }).catch(() => {});
  }
  // the other half of the product: a question, answered
  const got = await page.evaluate(async q => {
    window.app.handleAsk(q);
    for (let i = 0; i < 150; i++) {
      const html = document.querySelector('#ansBody').innerHTML;
      if (html && !/Looking that up/.test(html)) {
        return { answered: true, html, len: html.length, scene: window.app.i };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return { answered: false, scene: window.app.i };
  }, GROUNDED);
  return { ...got, via: fromBriefing(got.html) ? 'briefing' : 'model' };
}

/* ── how "answered from the briefing" is decided, and why not by the label ──
   This used to read `/grounded/.test(html) ? 'llm' : 'briefing'`, matching the
   word in the old provenance label "answered by Iris · grounded".

   src/app.js now writes four labels and NONE of them contains that word:
   "related briefing notes", "outside the briefing", "answered from the
   briefing", "not covered by the briefing". So the positive branch became
   unreachable, `via` was the constant 'briefing', and the assertion below — the
   one check in this suite that says the offline deck answers from its own
   knowledge base rather than a model — became trivially true. It passed. It
   would have gone on passing for a build whose provenance labelling was
   entirely broken, which is exactly the class of false pass this repo keeps
   finding (PR-DRAFT.md §12.3, and twice in tests/proxy.test.mjs).

   Matching the new labels instead would only reset the same trap: it is still a
   private copy of a string that lives in src/app.js. So this asks the question
   the check is actually about — is this the briefing's own reviewed text? — of
   the one place that can answer it, src/knowledge.js. A model's paraphrase does
   not contain an entry verbatim; the briefing's answer is an entry verbatim.
   Nothing to drift, and §4 below proves it still discriminates.               */
const norm = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function fromBriefing(html) {
  const text = norm(html);
  if (!text) return false;
  return KB.some(e => {
    const want = norm(e.a).slice(0, 60);
    return want.length >= 40 && text.includes(want);
  });
}

async function checkTarget(t, browser, target, budget, label) {
  const { page, errors, external, requests } = await openPage(browser, target, { budget });

  /* ── prove the interceptor before trusting its silence ──────────────── */
  const control = await page.evaluate(async () => {
    try {
      await fetch('https://api.elevenlabs.io/v1/does-not-exist');
      return 'REACHED THE NETWORK';
    } catch (e) { return 'blocked: ' + String(e.message).slice(0, 60); }
  });
  const controlSeen = external.length;
  t.ok(controlSeen === 1 && /blocked/.test(control),
    `${label}: positive control — a deliberate fetch IS seen and blocked`, `${control} (recorded ${controlSeen})`);
  /* Reset all three ledgers: that request was OURS, and so is the
     net::ERR_FAILED console error Chrome logs for the abort. Everything
     recorded after this line is the page's own doing. */
  external.length = 0;
  requests.length = 0;
  errors.length = 0;

  await ready(page, budget);
  const ask = await exercise(page, budget, { hasTransport: true });

  t.ok(external.length === 0,
    `${label}: ZERO network requests across cold open, narration and a question`,
    external.length ? external.slice(0, 5).join(' , ') : `${requests.length} request(s), all local`);

  const schemes = [...new Set(requests.map(u => u.split(':')[0]))].sort();
  t.ok(schemes.every(s => ['file', 'data', 'blob', 'about'].includes(s)),
    `${label}: every request stayed on a local scheme`, schemes.join(','));

  t.ok(ask.answered && ask.via === 'briefing',
    `${label}: the question is answered from the offline briefing, not a model`,
    `via=${ask.via} · ${ask.len} B · scene ${ask.scene}`);

  t.eq(errors, [], `${label}: no page errors with the network unplugged`);
  await page.context().close();
}

export async function run(t) {
  const browser = await launch();
  try {
    await checkTarget(t, browser, 'canvas', BUDGET.canvas, 'dist/index.html');
    await checkTarget(t, browser, 'three', BUDGET.three, 'dist/index-3d.html');

    /* dist/artifact.html has no <html>/<head>/<body> of its own — a Claude
       Artifact supplies those. It still has to hold the same promise, and it is
       the target most likely to sprout a CDN link, so it is checked too. */
    const budget = BUDGET.canvas;
    const { page, errors, external, requests } = await openPage(browser, 'artifact', { budget });
    await ready(page, budget);
    const ask = await exercise(page, budget, { hasTransport: true });
    t.ok(external.length === 0,
      'dist/artifact.html: ZERO network requests',
      external.length ? external.slice(0, 5).join(' , ') : `${requests.length} request(s), all local`);
    t.ok(ask.answered && ask.via === 'briefing',
      'dist/artifact.html: still answers questions, from the briefing',
      `via=${ask.via} · ${ask.len} B`);
    t.eq(errors, [], 'dist/artifact.html: no page errors');

    /* ── §4 the control: fromBriefing() can still say NO ──────────────────
       The check it backs asserts a constant ('briefing') on every target, so
       if the classifier ever became unconditionally true the three assertions
       above would go green for a deck answering from anywhere at all. That is
       precisely how the /grounded/ heuristic this replaced managed to pass
       while discriminating nothing. Two directions, both asserted. */
    const modelish = '<p>Rollout is usually phased by terminal over 18 to 24 months.</p>';
    t.ok(!fromBriefing(modelish),
      'control: fromBriefing() REJECTS a plausible model answer — it is not always true',
      JSON.stringify(modelish.slice(0, 54)));
    t.ok(fromBriefing(KB[0].a) && !fromBriefing(DONT_KNOW) && !fromBriefing(''),
      'control: …and ACCEPTS a knowledge-base entry, while DONT_KNOW is not one',
      `KB[0]=${fromBriefing(KB[0].a)} · DONT_KNOW=${fromBriefing(DONT_KNOW)} · empty=${fromBriefing('')}`);

    /* The fonts are the classic leak: a @font-face with an https src looks fine
       on every machine that has ever been online. Assert they are data URIs. */
    const fonts = await page.evaluate(() =>
      [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
        .filter(r => r.constructor.name === 'CSSFontFaceRule')
        .map(r => (r.style.getPropertyValue('src') || '').slice(0, 40)));
    // The value comes back quoted — url("data:font/otf;base64,…") — so the
    // optional quote is part of the pattern, not an oversight.
    t.ok(fonts.length > 0 && fonts.every(s => /^url\(["']?data:/.test(s)),
      'every @font-face is a data: URI, not a CDN',
      `${fonts.length} face(s): ${[...new Set(fonts.map(f => f.slice(0, 22)))].join(' ')}`);

    await page.context().close();
  } finally {
    await browser.close();
  }
}
