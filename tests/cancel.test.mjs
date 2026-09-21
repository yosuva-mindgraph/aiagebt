/* ============================================================================
   CANCEL MUST SETTLE. This is the normal path, not the edge case.

   The cold open says, in as many words, "Stop me with a question at any point."
   So being interrupted mid-line is the thing this deck is FOR, and the whole
   controller is built on one promise:

       await this.presenter.say(text)   // …always comes back

   Every await in app.js is followed by `if (my !== this.token) return`. That
   pattern is only as good as the await underneath it: a say() that never
   resolves does not throw, does not log, and does not fall over. It leaves the
   walkthrough held by a line the viewer already interrupted, with the answer
   sheet open on top of a deck that will never move again.

   There are four independent ways to get there, and the sharpest is the
   library's:

       stopSpeaking() { … this.speechQueue.length = 0; … }   // talkinghead.mjs

   A pending speakMarker() callback is IN that queue. Emptying it discards the
   callback without ever calling it — so on the 3D backend the "line finished"
   signal is destroyed by the very act of interrupting the line. Avatar3D.speak()
   answers that by resolving the promise itself in stopSpeaking(), with a
   done-guard; this suite is what says that answer works.

   ── THE ONE STUB IN THIS SUITE, AND WHY ───────────────────────────────────
   With no key and no voices, headless Chromium's speechSynthesis fires onerror
   in about a millisecond, so a line is over before it can be interrupted — a
   cancel test here would pass without ever cancelling anything. Two stubs fix
   that, and both make headless behave MORE like a real machine, not less:

     · speechSynthesis.speak → a no-op that never fires onend, i.e. a browser
       that is actually saying a long sentence out loud;
     · voice.synthesize → a synthetic 6-second Clip, i.e. the ElevenLabs path,
       which is the ONLY way to reach `backend.ownsPlayback && clip` — the
       branch where TalkingHead owns playback and the speakMarker trap lives.

   Everything else — presenter, backends, the controller — is the shipped code.
   Each measurement asserts the line was STILL IN FLIGHT at the moment of
   cancel; a vacuous pass is a failure here.
   ========================================================================== */

import { launch, openPage, ready, BUDGET } from './lib/harness.mjs';

const LINE = 'Twenty-one sources, governed end to end, and every one of them is still '
  + 'answerable to the same policy engine that decides what an agent may see.';

/* Installed into the page once; each probe is a call into it. */
const PROBE = `
window.__qa = {
  /* A Clip in the SAME AudioContext Voice is using — which, on the 3D backend,
     is TalkingHead's own (seam S3). A buffer from any other context would be
     resampled across the boundary, or refused. */
  makeClip(secs, nWords) {
    const v = window.app.presenter.voice;
    const ctx = v.audioCtx || v.useAudioContext(new (window.AudioContext || window.webkitAudioContext)());
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * secs), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i / 24) * 0.05;
    const words = Array.from({ length: nWords }, (_, i) => 'word' + i);
    const step = Math.round(secs * 1000 / nWords);
    return {
      audioBuffer: buf, words,
      wtimes: words.map((_, i) => i * step),
      wdurations: words.map(() => step),
      durationMs: Math.round(secs * 1000),
    };
  },

  /* Make a line take real time, the way it does on a machine with a voice. */
  slowWebSpeech() {
    if (!window.__qa._realSpeak) window.__qa._realSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = () => {};          // never fires onend — a long sentence
  },
  fastWebSpeech() {
    if (window.__qa._realSpeak) speechSynthesis.speak = window.__qa._realSpeak;
  },
  withClip(secs) {
    window.app.presenter.voice.synthesize = async () => window.__qa.makeClip(secs, 12);
  },
  noClip() { delete window.app.presenter.voice.synthesize; },

  /**
   * Start a line, wait, cancel it, and time how long say() takes to come back.
   * Returns { inFlight, settleMs, rejected, outcome }.
   *   inFlight false ⇒ the line ended before we cancelled ⇒ the measurement is
   *   worthless and the caller must fail rather than report a fast zero.
   */
  async cancelAfter(delayMs, text) {
    const p = window.app.presenter;
    let done = false, rejected = null, resolvedAt = 0;
    const flight = p.say(text).then(
      () => { done = true; resolvedAt = performance.now(); },
      e => { done = true; rejected = String(e && e.message || e); resolvedAt = performance.now(); },
    );
    await new Promise(r => setTimeout(r, delayMs));
    const inFlight = !done;
    const tCancel = performance.now();
    p.cancel();
    await Promise.race([flight, new Promise(r => setTimeout(r, 5000))]);
    return {
      inFlight,
      settleMs: done ? Math.round(resolvedAt - tCancel) : -1,
      rejected,
      outcome: done ? (rejected ? 'rejected' : 'resolved') : 'NEVER SETTLED',
    };
  },

  /* The same trap one layer down, on the backend itself: does stopSpeaking()
     resolve the promise speak() handed out, given the marker is gone? */
  async backendStop(delayMs) {
    const b = window.app.presenter.backend;
    const clip = b.ownsPlayback ? window.__qa.makeClip(6, 12) : null;
    let done = false, resolvedAt = 0, markerFired = false;
    const flight = b.speak('a line long enough to interrupt', 6000, clip)
      .then(() => { done = true; resolvedAt = performance.now(); });
    if (b.th && b.th.speakMarker) b.th.speakMarker(() => { markerFired = true; });
    await new Promise(r => setTimeout(r, delayMs));
    const inFlight = !done;
    const t = performance.now();
    b.stopSpeaking();
    await Promise.race([flight, new Promise(r => setTimeout(r, 5000))]);
    return {
      inFlight, markerFired,
      settleMs: done ? Math.round(resolvedAt - t) : -1,
      queueLen: b.th ? b.th.speechQueue.length : null,
      kind: b.kind,
    };
  },
};
`;

const LIMIT = 200;   // the brief's number, and a generous one for a local resolve

/* realtimeAudio — THIS SUITE MEASURES TIME, so it opts out of the harness's
   playback accelerant. FAST_AUDIO multiplies every AudioBufferSourceNode's
   playbackRate so a 14-minute deck fits a gate; here it would finish the
   six-second synthetic clip in half a second, the probe would cancel a line
   that had already ended, and the result is the one thing cancelAfter() refuses
   to report — a fast zero from a measurement that never happened. It fails
   loudly ("the line was still in flight"), which is the right failure, but the
   fix belongs here rather than in the budget. */
async function probeBackend(t, browser, target, budget, label) {
  const { page, errors } = await openPage(browser, target, { budget, realtimeAudio: true });
  const info = await ready(page, budget);
  await page.evaluate(PROBE);
  t.note(`${label}: backend=${info.backendKind}`);

  /* ── 1. Web Speech is doing the talking (the no-key path — what ships) ── */
  await page.evaluate(() => { window.__qa.slowWebSpeech(); window.__qa.noClip(); });
  for (const delay of [0, 400]) {
    const r = await page.evaluate(([d, line]) => window.__qa.cancelAfter(d, line), [delay, LINE]);
    t.ok(r.inFlight, `${label} · web-speech · cancel at ${delay}ms: the line was still in flight`,
      `(a "no" here makes the next assertion meaningless)`);
    t.ok(r.outcome === 'resolved' && r.settleMs >= 0 && r.settleMs < LIMIT,
      `${label} · web-speech · say() settles within ${LIMIT}ms of cancel()`,
      `${r.settleMs}ms, ${r.outcome}${r.rejected ? ` (${r.rejected})` : ''}`);
  }

  /* ── 2. an ElevenLabs Clip is doing the talking ────────────────────────
     On the 3D backend this is the ONLY branch that reaches
     `ownsPlayback && clip` — where TalkingHead owns playback and the discarded
     speakMarker would strand the promise. On the canvas backend it is
     voice.play()'s AudioBufferSourceNode instead. Both must let go. */
  await page.evaluate(() => window.__qa.withClip(6));
  for (const delay of [0, 600]) {
    const r = await page.evaluate(([d, line]) => window.__qa.cancelAfter(d, line), [delay, LINE]);
    t.ok(r.inFlight, `${label} · clip · cancel at ${delay}ms: the line was still in flight`);
    t.ok(r.outcome === 'resolved' && r.settleMs >= 0 && r.settleMs < LIMIT,
      `${label} · clip · say() settles within ${LIMIT}ms of cancel()`,
      `${r.settleMs}ms, ${r.outcome}${r.rejected ? ` (${r.rejected})` : ''}`);
  }

  /* ── 3. the backend's own promise, one layer down ──────────────────── */
  const b = await page.evaluate(() => window.__qa.backendStop(500));
  t.ok(b.inFlight, `${label} · backend.speak() was still running when stopSpeaking() landed`);
  t.ok(b.settleMs >= 0 && b.settleMs < LIMIT,
    `${label} · backend.speak()'s promise is resolved BY stopSpeaking()`,
    `${b.settleMs}ms (kind=${b.kind})`);
  if (b.kind === 'talkinghead') {
    t.ok(b.markerFired === false,
      'the speakMarker really was thrown away by stopSpeaking() — the trap is live, and survived',
      `markerFired=${b.markerFired}, speechQueue drained to ${b.queueLen}`);
    t.ok(b.queueLen === 0, 'TalkingHead\'s speechQueue is empty after stopSpeaking()', String(b.queueLen));
  }

  /* ── 4. say() twice in a row must not strand the first ─────────────── */
  const overlap = await page.evaluate(async line => {
    const p = window.app.presenter;
    let first = false;
    const a = p.say(line).then(() => { first = true; });
    await new Promise(r => setTimeout(r, 300));
    const b2 = p.say('a second line landing on top of the first');
    await new Promise(r => setTimeout(r, 400));
    p.cancel();
    await Promise.race([Promise.all([a, b2]), new Promise(r => setTimeout(r, 5000))]);
    return { first };
  }, LINE);
  t.ok(overlap.first, `${label} · a say() displaced by the next say() still resolves`);

  t.eq(errors, [], `${label}: no page errors while cancelling`);
  await page.context().close();
}

/** The real thing: interrupt the running walkthrough with a typed question. */
async function probeInterruptForReal(t, browser, budget) {
  // Same reason as probeBackend: every number below is a millisecond count.
  const { page, errors } = await openPage(browser, 'canvas', { budget, realtimeAudio: true });
  await ready(page, budget);

  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#avatarState').dataset.state === 'speaking',
    null, { timeout: budget.line });

  const r = await page.evaluate(async () => {
    const t0 = performance.now();
    document.querySelector('#askInput').value =
      'How do you stop an AI agent seeing data it should not see?';
    document.querySelector('#askForm').dispatchEvent(new Event('submit', { cancelable: true }));
    const pausedAt = performance.now() - t0;         // handleAsk() pauses synchronously
    const paused = window.app.playing === false;
    /* Wait for the answer to actually LAND. The placeholder is itself a <p>, so
       "there is markup" is not the condition — "the placeholder is gone" is. */
    for (let i = 0; i < 150; i++) {
      if (!/Looking that up/.test(document.querySelector('#ansBody').innerHTML)) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return {
      paused, pausedAt: Math.round(pausedAt),
      open: document.querySelector('#answer').classList.contains('open'),
      body: document.querySelector('#ansBody').textContent.trim().slice(0, 120),
      hasResume: Boolean(document.querySelector('[data-resume]')),
      sceneAtAsk: window.app.i,
    };
  });

  t.ok(r.paused, 'asking a question stops the walkthrough immediately', `pause landed at +${r.pausedAt}ms`);
  t.ok(r.open && r.body.length > 40 && !/Looking that up/.test(r.body),
    'the answer sheet opens with a real, grounded answer (no key, no network)',
    JSON.stringify(r.body.slice(0, 90)));
  t.ok(r.hasResume, 'and it offers to resume the walkthrough it interrupted');

  // …and resuming actually resumes, rather than sitting on a stale playing flag.
  const resumed = await page.evaluate(async () => {
    document.querySelector('[data-resume]').click();
    for (let i = 0; i < 120; i++) {
      if (document.querySelector('#avatarState').dataset.state === 'speaking') return { ok: true, i: window.app.i };
      await new Promise(r => setTimeout(r, 100));
    }
    return { ok: false, i: window.app.i, playing: window.app.playing };
  });
  t.ok(resumed.ok, 'Resume puts Iris back to speaking', JSON.stringify(resumed));

  t.eq(errors, [], 'no page errors across the interrupt-and-resume path');
  await page.context().close();
}

export async function run(t) {
  const browser = await launch();
  try {
    await probeBackend(t, browser, 'canvas', BUDGET.canvas, 'canvas');
    await probeBackend(t, browser, 'three', BUDGET.three, 'talkinghead');
    await probeInterruptForReal(t, browser, BUDGET.canvas);
  } finally {
    await browser.close();
  }
}
