/* ============================================================================
   The gate's plumbing: assertions, and a browser opened the way the deliverable
   is actually opened.

   Two things here are deliberate rather than convenient.

   1. EVERY PAGE IS OPENED FROM file://, NEVER FROM A SERVER. The promise this
      product makes is "copy it to a booth machine, unplug the network,
      double-click it". A test served over http:// passes and tells you nothing:
      fetch() of a sibling file is CORS-blocked under file:// and is not under
      http://, which is the exact difference the 3D avatar's base64→Blob path
      exists to work around.

   2. NETWORK IS INTERCEPTED, NOT INFERRED. openPage() routes every request and
      ABORTS anything that is not file:/data:/blob:/about:. So "no network" is
      not a claim read off a config flag — a request that tried to leave is a
      recorded, failed request, and the suite reports it by URL.

   The only stub anywhere in this suite is an optional synthetic ElevenLabs Clip
   (tests/cancel.test.mjs), because the one path that cannot be exercised with no
   key is the one where a key produced audio. Nothing else is faked: the deck
   under test is the built file, running its own code, on its own clock.
   ========================================================================== */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PW = process.env.AIB_PLAYWRIGHT
  || '/home/mindgraph1/projects/dxcaib/aibgames-gen/node_modules/playwright';
export const { chromium } = require(PW);

/* Software WebGL (SwiftShader) is perhaps 30x slower than a GPU, and the 3D
   target is a 10 MB file that has to parse before anything paints. So the two
   targets get different budgets rather than one pessimistic number that would
   make the canvas gate — the one that runs constantly — needlessly slow. */
export const BUDGET = {
  canvas: { load: 20000, attach: 10000, deck: 180000, line: 15000 },
  three: { load: 90000, attach: 90000, deck: 420000, line: 40000 },
};

export const TARGETS = {
  canvas: 'dist/index.html',
  three: 'dist/index-3d.html',
  artifact: 'dist/artifact.html',
};

export const fileUrl = rel => 'file://' + path.join(ROOT, rel);

/* ── assertions ───────────────────────────────────────────────────────── */

export class T {
  constructor(suite) {
    this.suite = suite;
    this.results = [];
  }

  /** Record a check. `detail` is printed either way — evidence beats a tick. */
  ok(pass, name, detail = '') {
    this.results.push({ pass: Boolean(pass), name, detail: String(detail) });
    const mark = pass ? '  ok  ' : '  ✗   ';
    console.log(`${mark}${name}${detail ? `  — ${detail}` : ''}`);
    return Boolean(pass);
  }

  eq(actual, expected, name) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    return this.ok(a === e, name, a === e ? a : `got ${a}, want ${e}`);
  }

  note(line) { console.log(`        ${line}`); }

  get failed() { return this.results.filter(r => !r.pass); }
}

/* ── browser ──────────────────────────────────────────────────────────── */

/* Kill WebGL at the source rather than by launch flag. --disable-gpu still
   leaves SwiftShader answering getContext('webgl'), which is precisely the
   machine we are NOT simulating: the booth laptop with a blocklisted driver
   where the context request comes back null. This is that machine. */
export const KILL_WEBGL = `
  (() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/i.test(String(type))) return null;
      return real.call(this, type, ...rest);
    };
  })();
`;

/* ── the audio accelerant, and why every suite gets it by default ─────────
   The canvas targets now carry ~14 minutes of pre-rendered narration, and the
   deck plays it. That is the feature; it is also a problem for a gate, and the
   problem is not the one it looks like.

   Every budget in this file was calibrated against a deck that narrated in
   ESSENTIALLY NO TIME. That was never a property of the deck — it was a
   property of the BOX. With no key, the canvas path ended in
   voice.speakBrowser(), and a headless Chromium with no installed
   speech-synthesis voice fires onerror in about a millisecond, so a line cost
   nothing and twelve scenes cost a few seconds. tests/integration.test.mjs says
   so in as many words, beside the assertion it stopped anyone from writing.
   Baked audio removes the accident: a line now costs exactly as long as the
   line, and the full deck is 14.1 minutes on every machine.

   Two ways out. Multiply every deck budget by fifteen and accept an hour-long
   gate — or play the same audio faster. This does the second: every
   AudioBufferSourceNode the page makes gets a playbackRate, so the clip is
   still fetched from the payload, still base64-decoded, still decoded to PCM,
   still routed through the analyser, still ends by firing onended — the whole
   path under test — in a twelfth of the wall time. Nothing is stubbed and
   nothing is skipped; only the clock moves.

   It is ON BY DEFAULT because the alternative is each suite remembering, and
   the one that forgets fails as a stall rather than as a timeout. Opt out with
   openPage(..., { realtimeAudio: true }) where the point IS the real duration —
   tests/voice.test.mjs does, because it asserts a clip plays at its own length.  */
export const FAST_AUDIO_RATE = 12;

export const FAST_AUDIO = `
  (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const real = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function (...a) {
      const node = real.apply(this, a);
      try { node.playbackRate.value = ${FAST_AUDIO_RATE}; } catch (e) {}
      return node;
    };
  })();
`;

export async function launch() {
  return chromium.launch({
    /* Headless Chrome will not start an AudioContext without a user gesture,
       and several assertions here depend on audio actually running. */
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
}

/**
 * Open a built target from file://, wired for evidence.
 *
 * Returns { page, ctx, errors, external, requests } where
 *   errors    — page errors and console.error text, in order
 *   external  — every request that tried to leave file:// (aborted)
 *   requests  — every request URL seen, for reporting
 */
export async function openPage(browser, target, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  /* FAST_AUDIO first, so a suite's own initScript can still override it. */
  if (!opts.realtimeAudio) await ctx.addInitScript({ content: FAST_AUDIO });
  if (opts.initScript) await ctx.addInitScript({ content: opts.initScript });

  const page = await ctx.newPage();
  const errors = [], external = [], requests = [], warnings = [];

  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') errors.push('console.error: ' + m.text().slice(0, 300));
    else if (t === 'warning') warnings.push(m.text().slice(0, 300));
  });

  const LOCAL = /^(file|data|blob|about):/;
  await page.route('**/*', route => {
    const url = route.request().url();
    requests.push(url);
    if (LOCAL.test(url)) return route.continue();
    external.push(url);          // the assertion: this array must stay empty
    return route.abort();
  });

  const rel = TARGETS[target] || target;
  await page.goto(fileUrl(rel), {
    waitUntil: 'load',
    timeout: (opts.budget || BUDGET.canvas).load,
  });
  return { page, ctx, errors, external, requests, warnings };
}

/** Wait for App to exist and its presenter to have attached. */
export async function ready(page, budget) {
  await page.waitForFunction(() => Boolean(window.app), null, { timeout: budget.attach });
  return page.evaluate(async () => {
    await window.app.ready;
    return {
      backendKind: window.app.presenter.backendKind,
      scenes: SCENES.length,
    };
  });
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
