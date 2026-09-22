/* ============================================================================
   THE ONE COPY OF THE PROXY CONTRACT.

   Everything the proxy suites need to pretend to be `aib-proxy` — the two
   upstream response bodies, the stub that serves them, the counter that says
   whether the page called out at all, and a way to run the REAL proxy against
   a stubbed upstream — lives in this file and nowhere else.

   ── why one file, and why it derives instead of declaring ─────────────────
   PR-DRAFT.md §12.3 records THREE gate failures with one cause between them: a
   test fixture holding its own private copy of a contract, which then drifted
   from the real one. A corpus that omitted DONT_KNOW; a constant renamed in
   build.js and not in the suite that read it; a pin() stub still returning four
   fields after a fifth was added. Each was a literal typed into a test because
   typing it was easier than importing it.

   A fourth is available here and it is the worst of the four, because the
   contract has TWO ends and a test sits between them. `audio_base64`,
   `character_start_times_seconds`, `content[].type === 'text'` — rename any of
   those in src/ and a hand-written fixture keeps answering the old shape
   forever. The suite stays green while the deck goes silent, which is precisely
   the failure the pre-rendered voice work existed to stop.

   So the two fixtures below are VALIDATED BY THEIR REAL CONSUMERS rather than
   trusted:

     · the ElevenLabs body is fed through src/voice.js's own exported
       pickAlignment() and wordsFromAlignment() by selfCheck(), and must come
       back with the words it was built from. Rename a field in voice.js and
       this throws by name, in every suite, before a single assertion runs.
     · the Anthropic body is fed through the same expression src/ask.js uses to
       read one, taken from ask.js rather than restated.

   selfCheck() is called at the top of each suite that imports this. It is the
   check on the checks, and it is cheap; run it.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { ROOT, fileUrl, BUDGET, FAST_AUDIO } from './harness.mjs';
import { pickAlignment, wordsFromAlignment } from '../../src/voice.js';

/* ── the two routes, named once ─────────────────────────────────────────────
   config.public.js sets these and src/ask.js + src/voice.js call them. They are
   read OUT of config.public.js rather than typed, so a suite asserting "the
   page called /api/llm" cannot be asserting about a path the deployment no
   longer uses. */
export const PUBLIC_CONFIG_FILE = 'config.public.js';

export function publicEndpoints() {
  const src = fs.readFileSync(path.join(ROOT, PUBLIC_CONFIG_FILE), 'utf8');
  const sandbox = { window: {} };
  // Same technique build.js's own guard uses: run the assignment, read the
  // object. A regex over this file would be reading its prose.
  const vm = require('node:vm');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: PUBLIC_CONFIG_FILE, timeout: 2000 });
  const cfg = sandbox.window.AIB_CONFIG || {};
  return { llm: cfg?.llm?.endpoint || null, tts: cfg?.elevenLabs?.endpoint || null, cfg };
}

/* createRequire, because this file is ESM and node:vm is easier to reach that
   way than to import lazily in a function. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

/* ── fixture 1: an Anthropic Messages response ───────────────────────────── */

/**
 * The body POST /api/llm passes through. Shape validated against the exact
 * expression src/ask.js uses to read one — see selfCheck().
 */
export function anthropicBody(html = '<p>A grounded answer about Intelligent Airport.</p>') {
  return {
    id: 'msg_stubbed_no_api_call_was_made',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text: html }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

/** Exactly how src/ask.js reads one, lifted from _callLLM so it cannot drift. */
export function readAnthropic(data) {
  return Array.isArray(data.content)
    ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    : (data.output_text || data.choices?.[0]?.message?.content || '');
}

/* ── fixture 2: an ElevenLabs /with-timestamps response ──────────────────── */

/* Real MP3, never a synthesised one, and never a fresh API call: the bytes come
   out of the pre-rendered speech this repo already carries. assets/voice-clips.js
   is generated and gitignored, so it may be absent on a clone — hasAudio() says
   so and the suites degrade to the checks that do not need a decode rather than
   failing on a missing generated file. */
let _audioCache;

function realClipBase64() {
  if (_audioCache !== undefined) return _audioCache;
  _audioCache = null;
  const p = path.join(ROOT, 'assets', 'voice-clips.js');
  if (!fs.existsSync(p)) return _audioCache;
  const src = fs.readFileSync(p, 'utf8');
  const sandbox = { window: {} };
  require('node:vm').createContext(sandbox);
  try {
    require('node:vm').runInContext(src, sandbox, { timeout: 20000 });
  } catch { return _audioCache; }
  const clips = sandbox.window.AIB_VOICE_CLIPS?.clips || {};
  const first = Object.values(clips)[0];
  if (first?.a) _audioCache = first.a;
  return _audioCache;
}

export const hasAudio = () => Boolean(realClipBase64());

/**
 * An ElevenLabs /with-timestamps body for `text`.
 *
 * The character alignment is BUILT from the text — one entry per character,
 * evenly spread over `durationS` — rather than transcribed from a recording,
 * because what is under test is that the client can READ an alignment, not that
 * ElevenLabs can produce one. The field NAMES are the part that matters and
 * they are the part selfCheck() proves, by handing this to voice.js's own
 * pickAlignment()/wordsFromAlignment() and requiring the words back.
 */
export function elevenLabsBody(text = 'A stubbed line of speech.', durationS = 2) {
  const characters = [...String(text)];
  const step = characters.length ? durationS / characters.length : 0;
  const starts = characters.map((_, i) => Number((i * step).toFixed(6)));
  const ends = characters.map((_, i) => Number(((i + 1) * step).toFixed(6)));
  const alignment = {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  };
  return {
    audio_base64: realClipBase64() || '',
    alignment,
    // normalized_alignment is what pickAlignment() prefers; give it the same
    // arrays so a suite is never quietly testing the fallback branch.
    normalized_alignment: {
      characters: [...characters],
      character_start_times_seconds: [...starts],
      character_end_times_seconds: [...ends],
    },
  };
}

/* ── the check on the checks ─────────────────────────────────────────────── */

/**
 * Prove both fixtures still satisfy their real consumers. Throws — loudly, by
 * field name — rather than returning false, because a suite that carries on
 * with a stale fixture is the §12.3 failure repeating.
 */
export function selfCheck() {
  const text = 'Intelligent Airport reads every source system.';

  const words = text.split(/\s+/);
  const picked = pickAlignment(elevenLabsBody(text, 3));
  if (!picked) {
    throw new Error(
      'proxy-fixtures: src/voice.js pickAlignment() rejected elevenLabsBody(). ' +
      'The /with-timestamps field names in this file have drifted from voice.js — ' +
      'it wants characters + character_start_times_seconds + character_end_times_seconds.');
  }
  const got = wordsFromAlignment(picked);
  if (got.words.join(' ') !== words.join(' ')) {
    throw new Error(
      `proxy-fixtures: wordsFromAlignment() read ${JSON.stringify(got.words)} ` +
      `from the fixture, wanted ${JSON.stringify(words)}.`);
  }
  if (!(got.wtimes.length === words.length && got.wdurations.length === words.length)) {
    throw new Error('proxy-fixtures: the fixture produced mismatched timing arrays.');
  }

  const html = '<p>self check</p>';
  if (readAnthropic(anthropicBody(html)) !== html) {
    throw new Error(
      'proxy-fixtures: anthropicBody() no longer reads back through the expression ' +
      'src/ask.js uses — the Messages response shape has drifted.');
  }

  const { llm, tts } = publicEndpoints();
  if (!llm || !tts) {
    throw new Error(`proxy-fixtures: ${PUBLIC_CONFIG_FILE} no longer declares both endpoints ` +
      `(llm=${llm}, tts=${tts}).`);
  }
  return { llm, tts, audio: hasAudio() };
}

/* ── WHY THIS SUITE SERVES THE DECK OVER http:// ─────────────────────────────

   Every other suite in this gate opens the deck from file://, deliberately, and
   harness.mjs argues the case at length: the promise is "copy it to a booth
   machine, unplug the network, double-click it", and a page served over http
   passes checks that a file:// page would fail.

   This suite is the one place that reasoning inverts, and it is worth writing
   down because the wrong choice here produces a PASS.

   The --public-config build's endpoints are RELATIVE — '/api/llm'. Opened from
   file://, that resolves to file:///api/llm, and Chrome refuses it in the
   network stack before any interception happens:

       Fetch API cannot load file:///api/llm. URL scheme "file" is not supported.

   Playwright's page.route() never sees the request. So a counter that watches
   for proxy calls from a file:// page reports ZERO CALLS ALWAYS — for every
   build, however wired, even one that tries to call out on every keystroke. It
   would be the most reassuring possible way to measure nothing, and the number
   it produces is exactly the number this suite exists to report.

   The --public-config artifact is also the ONE target that is never opened from
   file:// in real life. It is built to be served by nginx behind a tunnel. So
   these checks run against the deployment's own transport: a static server on
   127.0.0.1, same-origin, with /api/llm and /api/tts intercepted and counted.
   The file:// targets keep their own suites; this one tests the thing that
   ships at a URL.                                                            */

export function serveDir(dir) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]);
    const name = rel === '/' ? '/index.html' : rel;
    const file = path.join(dir, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(r)),
      });
    });
  });
}

/* ── the browser-side stub, which is also the counter ────────────────────── */

const isProxyCall = (url, ep) => {
  let p;
  try { p = new URL(url).pathname; } catch { return false; }
  return ep.some(e => e && p === e);
};

/**
 * Open a built target with every request classified and, optionally, the two
 * proxy routes answered.
 *
 * mode:
 *   'ok'       — both routes answer a valid upstream body
 *   'refused'  — both routes abort, as a connection refused does
 *   'absent'   — both routes 404, as nginx with no proxy behind it does
 *   'wedged'   — both routes ACCEPT AND NEVER REPLY. The real failure: a tunnel
 *                still up in front of a dead backend. Nothing rejects, so only
 *                a client-side deadline ends it.
 *   'count'    — never answered and never aborted is wrong for a counter, so
 *                'count' behaves as 'ok' and exists only to read well at the
 *                call site.
 *
 * Returns { page, ctx, errors, warnings, calls, external, requests } where
 * `calls` is every request to /api/llm or /api/tts, by path, in order. That
 * array's LENGTH is the number the zero-network check is about.
 */
export async function openDeck(browser, target, opts = {}) {
  const { llm, tts } = publicEndpoints();
  const endpoints = [llm, tts];
  /* PER-ROUTE modes, because one mode for both cannot reach the TTS deadline at
     all. Wedge everything and /api/llm times out first; the answer then falls
     back to the local knowledge base, whose `spoken` string IS pre-rendered, so
     voice.js returns the baked clip at step 0 and /api/tts is never called. A
     check written that way passes while measuring a clip playing — which is
     what it did, at 5.5 s against a 1.5 s deadline, before this existed. To
     exercise a wedged /api/tts the LLM must SUCCEED: only a model-written answer
     is text nobody pre-rendered. */
  const mode = opts.mode || 'ok';
  const modeFor = route => (opts.modes && opts.modes[route]) || mode;
  const budget = opts.budget || BUDGET.canvas;

  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  if (!opts.realtimeAudio) await ctx.addInitScript({ content: FAST_AUDIO });
  if (opts.initScript) await ctx.addInitScript({ content: opts.initScript });

  const page = await ctx.newPage();
  const errors = [], warnings = [], external = [], requests = [], calls = [];

  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') errors.push('console.error: ' + m.text().slice(0, 300));
    else if (t === 'warning') warnings.push(m.text().slice(0, 300));
  });

  const LOCAL = /^(file|data|blob|about):/;
  const wedged = [];
  const selfOrigin = opts.origin || null;

  await page.route('**/*', async route => {
    const url = route.request().url();
    requests.push(url);

    if (isProxyCall(url, endpoints)) {
      const which = new URL(url).pathname;
      calls.push({ path: which, at: Date.now(), body: route.request().postData() });

      const isTts = tts && which === tts;
      const m = modeFor(isTts ? 'tts' : 'llm');

      if (m === 'refused') return route.abort('connectionrefused');
      if (m === 'absent') {
        return route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' });
      }
      if (m === 'wedged') {
        // Accepted, never answered. Held rather than dropped: the point is that
        // nothing on the wire ever ends this, so only the client's own timer can.
        wedged.push(route);
        return;
      }
      const body = isTts
        ? elevenLabsBody(opts.ttsText || 'A stubbed line of speech.')
        : anthropicBody(opts.llmHtml || '<p>A stubbed answer from the proxy.</p>');
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body),
      });
    }

    /* Serving over http means the page's OWN document and any sibling it pulls
       are http too. Those are not "the deck reaching the internet" — they are
       the deck being served. Anything on another origin still is, and is
       aborted and recorded exactly as harness.openPage() does it. */
    if (LOCAL.test(url)) return route.continue();
    if (selfOrigin && url.startsWith(selfOrigin)) return route.continue();
    external.push(url);
    return route.abort();
  });

  const url = opts.url || fileUrl(opts.rel || target);
  await page.goto(url, { waitUntil: 'load', timeout: budget.load });

  return {
    page, ctx, errors, warnings, calls, external, requests,
    endpoints: { llm, tts },
    /* Release anything held by 'wedged' so closing the context is not waiting
       on a route that will never be answered. */
    release: () => { wedged.splice(0).forEach(r => r.abort().catch(() => {})); },
  };
}

/* ── a --public-config build, without touching dist/ ─────────────────────── */

/* build.js writes to <its own dir>/dist and the gate's step 0 has already put
   the three real targets there. A suite that rebuilds dist/ with a different
   config would hand every LATER suite a deck it was not written for — offline,
   degrade and integration all read dist/index.html. So the public build happens
   in a scratch tree of symlinks with a dist/ of its own, and dist/ in the real
   tree is never opened for writing. */
export const SCRATCH = path.join('tests', '.tmp', 'public-build');

const LINKS = ['index.html', 'src', 'assets', 'vendor', 'tools', PUBLIC_CONFIG_FILE];

/**
 * Run `node build.js --public-config <extra…>` in a scratch tree.
 * Returns { code, stdout, stderr, dir, rel(name) } — `rel` gives the path of a
 * built target RELATIVE TO ROOT, which is what harness.fileUrl() wants.
 *
 * `overrides` lets a check replace a source file for the duration of one build
 * (the guard's positive control writes a config.public.js with a key in it).
 */
/* Each build gets its OWN directory. They used to share one, and the three
   guard checks — which deliberately build a config.public.js that must be
   REFUSED — wiped the good build a static server was still serving, so the
   browser half failed at attach with no hint that the cause was a sibling
   check. A refused build leaves an empty dist/, which is correct behaviour and
   was being mistaken for a broken deck. */
let _buildSeq = 0;

export function buildPublic({ args = [], overrides = {}, name = '' } = {}) {
  const dir = path.join(ROOT, SCRATCH, name || `b${++_buildSeq}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });

  /* build.js is COPIED, not linked: __dirname resolves through a symlink to the
     real tree, and a linked build.js would quietly write to the real dist/. */
  fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(dir, 'build.js'));

  for (const name of LINKS) {
    const from = path.join(ROOT, name);
    if (!fs.existsSync(from)) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, name)) continue;
    fs.symlinkSync(from, path.join(dir, name));
  }
  for (const [name, content] of Object.entries(overrides)) {
    if (content === null) continue;                     // deliberately absent
    fs.writeFileSync(path.join(dir, name), content);
  }

  const res = require('node:child_process').spawnSync(
    process.execPath, ['build.js', '--public-config', ...args],
    { cwd: dir, encoding: 'utf8', timeout: 180000 });

  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    dir,
    read: n => fs.readFileSync(path.join(dir, 'dist', n), 'utf8'),
    exists: n => fs.existsSync(path.join(dir, 'dist', n)),
    rel: n => path.relative(ROOT, path.join(dir, 'dist', n)),
  };
}

export function cleanScratch() {
  fs.rmSync(path.join(ROOT, 'tests', '.tmp'), { recursive: true, force: true });
}

/* ── the REAL proxy, against a stubbed upstream ──────────────────────────── */

/* proxy/server.mjs calls api.anthropic.com and api.elevenlabs.io by absolute
   URL. To exercise the real file — which is the only way to prove what it does
   with a client's `system` — its global fetch is replaced before it loads, by
   tests/lib/upstream-stub.mjs passed to node --import. No feature code is
   edited and nothing can leave the machine: the stub is installed before
   server.mjs's first line runs, and it answers every URL itself.

   The keys below are obvious fakes and are the only ones this suite has. No
   real credential is read, from config.js or anywhere else, and no check here
   needs one. */
export const FAKE_ENV = {
  ANTHROPIC_API_KEY: 'sk-ant-FAKE-not-a-real-key-000000000000',
  ELEVENLABS_API_KEY: 'sk_FAKEfakefakefakefake000000000000',
  ELEVENLABS_VOICE_ID: 'fake-voice-id-for-tests',
};

/**
 * Start proxy/server.mjs on 127.0.0.1 with its upstream stubbed.
 * Returns { base, stop(), captured(), stdout() } where captured() is every
 * upstream request the server ATTEMPTED, as the stub recorded it.
 */
export async function startRealProxy({ env = {}, upstream = {} } = {}) {
  const dir = path.join(ROOT, 'tests', '.tmp');
  fs.mkdirSync(dir, { recursive: true });
  const capturePath = path.join(dir, `upstream-${process.pid}-${Date.now()}.jsonl`);
  fs.writeFileSync(capturePath, '');

  const child = spawn(process.execPath, [
    '--import', path.join(ROOT, 'tests', 'lib', 'upstream-stub.mjs'),
    path.join(ROOT, 'proxy', 'server.mjs'),
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...FAKE_ENV,
      ...env,
      AIB_UPSTREAM_CAPTURE: capturePath,
      AIB_UPSTREAM_MODE: upstream.mode || 'ok',
      AIB_UPSTREAM_STATUS: String(upstream.status || 200),
      AIB_UPSTREAM_BODY: upstream.body || '',
      BIND_ADDR: env.BIND_ADDR || '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });

  const base = 'http://127.0.0.1:8091';
  const deadline = Date.now() + 15000;
  let up = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const r = await fetch(base + '/healthz');
      if (r.ok) { up = true; break; }
    } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 120));
  }

  return {
    base,
    up,
    exitCode: () => child.exitCode,
    stdout: () => out,
    captured: () => fs.readFileSync(capturePath, 'utf8')
      .split('\n').filter(Boolean).map(l => JSON.parse(l)),
    stop: async () => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      await new Promise(r => setTimeout(r, 60));
      try { fs.rmSync(capturePath, { force: true }); } catch { /* fine */ }
    },
  };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
