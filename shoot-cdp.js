#!/usr/bin/env node
/* ============================================================================
   Look at it — with no Playwright.

   Drives a local Chrome-family browser (Chrome, Chromium, Brave, Edge) in
   headless mode over the DevTools protocol, using only Node's built-in
   WebSocket (Node 22+). Same job as shoot.js: every scene at 1920x1080 and
   1440x900, the answer sheet on a real question, a don't-know, the light
   theme, and the AIRIS run — and it reports horizontal overflow, missing
   figures and page errors, the faults a screenshot alone will not tell you.

       node shoot-cdp.js                 all scenes, both sizes
       node shoot-cdp.js --scene live    one scene (substring of the title)
       AIB_BROWSER=/path/to/Chrome node shoot-cdp.js

   Output lands in shots/ (gitignored). Exit code 1 on any problem.
   ========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'shots');
const PORT = Number(process.env.AIB_CDP_PORT || 9333);
const URL_ = process.env.AIB_URL || 'file://' + path.join(ROOT, 'dist', 'index.html');

const CANDIDATES = [
  process.env.AIB_BROWSER,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

const SIZES = [
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
];

const argScene = (() => {
  const i = process.argv.indexOf('--scene');
  return i > -1 ? process.argv[i + 1] : null;
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── tiny CDP client ─────────────────────────────────────────────────── */

function getJSON(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        if (!p) return;
        m.error ? p.reject(new Error(`${m.error.message} (${m.error.data || ''})`)) : p.resolve(m.result);
      } else {
        (this.listeners.get(m.method) || []).forEach(fn => fn(m.params));
      }
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws failed')); });
    return new CDP(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) { this.listeners.set(method, [...(this.listeners.get(method) || []), fn]); }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeout);
      this.on(method, p => { clearTimeout(t); resolve(p); });
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }
}

/* ── the run ─────────────────────────────────────────────────────────── */

(async () => {
  const bin = CANDIDATES.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } });
  if (!bin) { console.error('no Chrome-family browser found — set AIB_BROWSER=/path/to/binary'); process.exit(2); }

  fs.mkdirSync(OUT, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'aib-shoot-'));
  const proc = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--disable-sync', '--window-size=1920,1080', 'about:blank',
  ], { stdio: 'ignore' });
  const cleanup = () => { try { proc.kill(); } catch {} try { fs.rmSync(userData, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);

  // wait for the debugger endpoint
  let targets = null;
  for (let i = 0; i < 75 && !targets; i++) {
    try { targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`); } catch { await sleep(200); }
  }
  if (!targets) { console.error('browser did not expose the DevTools port'); process.exit(2); }
  let page = targets.find(t => t.type === 'page');
  if (!page) page = await getJSON(`http://127.0.0.1:${PORT}/json/new?about:blank`, 'PUT');

  const cdp = await CDP.connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const problems = [];
  let sizeName = '';
  cdp.on('Runtime.exceptionThrown', p => problems.push(`[${sizeName}] page error: ${p.exceptionDetails?.exception?.description || p.exceptionDetails?.text}`));
  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') problems.push(`[${sizeName}] console: ${p.args.map(a => a.value ?? a.description).join(' ')}`);
  });

  const goto = async url => {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    await loaded;
    await sleep(500);
  };

  for (const size of SIZES) {
    sizeName = size.name;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false });
    await goto(URL_);

    // cold open
    await cdp.shot(path.join(OUT, `${size.name}-00-open.png`));

    // start, muted, so the run is fast and deterministic
    await cdp.eval(`window.app.voice.setMuted(true); document.querySelector('#skipIntroBtn').click(); true`);
    await sleep(300);

    const scenes = await cdp.eval(`[...document.querySelectorAll('#sceneList .strip-item')].map((b, i) => ({ i, t: b.querySelector('.t').textContent }))`);

    for (const s of scenes) {
      if (argScene && !String(s.t).toLowerCase().includes(argScene.toLowerCase())) continue;
      await cdp.eval(`window.app.render(${s.i}, { play: false }); true`);
      await sleep(450);
      const slug = String(s.t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await cdp.shot(path.join(OUT, `${size.name}-${String(s.i + 1).padStart(2, '0')}-${slug}.png`));

      const overflow = await cdp.eval(`({
        body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stage: (() => { const el = document.querySelector('#stage'); return el.scrollWidth - el.clientWidth; })(),
      })`);
      if (overflow.body > 1) problems.push(`[${size.name}] "${s.t}" — page scrolls sideways by ${overflow.body}px`);
      if (overflow.stage > 1) problems.push(`[${size.name}] "${s.t}" — stage overflows by ${overflow.stage}px`);
    }

    if (argScene) continue;

    // the AIRIS run, mid-flight
    await cdp.eval(`window.app.goto('airis', { play: false }); document.querySelector('#airisBtn').click(); true`);
    await sleep(2600);
    await cdp.shot(path.join(OUT, `${size.name}-96-airis-running.png`));

    // the answer sheet, on a real question — with figures
    await cdp.eval(`window.app.goto('ask', { play: false }); window.app.handleAsk('How do you stop an AI agent seeing data it should not see?'); true`);
    await sleep(1100);
    await cdp.shot(path.join(OUT, `${size.name}-99-answer.png`));
    const figs = await cdp.eval(`({
      hidden: document.querySelector('#ansFigs').hidden,
      tiles: document.querySelectorAll('#ansFigs .fig').length,
      related: document.querySelectorAll('#ansFigs .also button').length,
      words: document.querySelector('#ansBody').textContent.trim().split(/\\s+/).length,
      overflow: (() => { const el = document.querySelector('#answer'); return el.scrollWidth - el.clientWidth; })(),
    })`);
    if (figs.hidden || figs.tiles === 0) problems.push(`[${size.name}] answer sheet shows no figures`);
    if (figs.overflow > 1) problems.push(`[${size.name}] answer sheet overflows by ${figs.overflow}px`);
    console.log(`[${size.name}] answer: ${figs.tiles} figures · ${figs.related} related · ${figs.words} words`);

    // a don't-know
    await cdp.eval(`window.app.handleAsk('What are your holiday plans this year?'); true`);
    await sleep(900);
    const dk = await cdp.eval(`document.querySelector('#ansBody').textContent.includes('rather say so')`);
    if (!dk) problems.push(`[${size.name}] off-topic question did not get the honest don't-know`);
    await cdp.shot(path.join(OUT, `${size.name}-98-dontknow.png`));

    // light theme, on the data scene
    await cdp.eval(`document.querySelector('#ansClose').click(); document.documentElement.dataset.theme = 'light'; window.app.goto('data', { play: false }); true`);
    await sleep(500);
    await cdp.shot(path.join(OUT, `${size.name}-97-light-data.png`));
    await cdp.eval(`document.documentElement.dataset.theme = 'dark'; true`);
  }

  try { cdp.ws.close(); } catch {}
  cleanup();

  const shots = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length;
  console.log(`${shots} shots → shots/`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach(p => console.log('  ✗ ' + p));
    process.exit(1);
  }
  console.log('no overflow, no page errors, figures present.');
  process.exit(0);
})().catch(err => { console.error('shoot-cdp failed:', err.message); process.exit(2); });
