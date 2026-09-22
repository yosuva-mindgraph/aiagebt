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
  off(method, fn) { this.listeners.set(method, (this.listeners.get(method) || []).filter(f => f !== fn)); }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const fn = p => { clearTimeout(t); this.off(method, fn); resolve(p); };
      const t = setTimeout(() => { this.off(method, fn); reject(new Error(`timeout waiting for ${method}`)); }, timeout);
      this.on(method, fn);
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
    '--disable-extensions', '--disable-sync', '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--window-size=1920,1080', 'about:blank',
  ], { stdio: 'ignore' });
  const cleanup = () => { try { proc.kill(); } catch {} try { fs.rmSync(userData, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });

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

  /** Poll a page expression until it is truthy (or time runs out). */
  const waitFor = async (expr, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await cdp.eval(expr)) return true; await sleep(150); }
    return false;
  };
  const key = async (k, text) => {
    const code = { '/': 'Slash', ' ': 'Space', ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', Escape: 'Escape' }[k] || k;
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: text ?? (k.length === 1 ? k : undefined) });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
  };

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
    if (!await waitFor(`!!document.querySelector('#ansBody .ans-src')`)) problems.push(`[${size.name}] answer never arrived`);
    await sleep(400);
    await cdp.shot(path.join(OUT, `${size.name}-99-answer.png`));
    const figs = await cdp.eval(`({
      hidden: document.querySelector('#ansFigs').hidden,
      tiles: document.querySelectorAll('#ansFigs .fig').length,
      related: document.querySelectorAll('#ansFigs .also button').length,
      words: document.querySelector('#ansBody').textContent.trim().split(/\\s+/).length,
      via: document.querySelector('#ansBody .ans-src .lbl')?.textContent || '',
      text: document.querySelector('#ansBody').textContent.trim().slice(0, 300),
      overflow: (() => { const el = document.querySelector('#answer'); return el.scrollWidth - el.clientWidth; })(),
    })`);
    if (figs.hidden || figs.tiles === 0) problems.push(`[${size.name}] answer sheet shows no figures`);
    if (figs.overflow > 1) problems.push(`[${size.name}] answer sheet overflows by ${figs.overflow}px`);
    console.log(`[${size.name}] answer: ${figs.tiles} figures · ${figs.related} related · ${figs.words} words · via "${figs.via}"`);
    if (/grounded/.test(figs.via)) console.log(`   → ${figs.text}`);

    // a don't-know
    await cdp.eval(`window.app.handleAsk('What are your holiday plans this year?'); true`);
    if (!await waitFor(`!!document.querySelector('#ansBody .ans-src') || /rather say so/.test(document.querySelector('#ansBody').textContent)`)) problems.push(`[${size.name}] don't-know never arrived`);
    await sleep(300);
    const dk = await cdp.eval(`({ local: document.querySelector('#ansBody').textContent.includes('rather say so'), via: document.querySelector('#ansBody .ans-src .lbl')?.textContent || '', text: document.querySelector('#ansBody').textContent.trim().slice(0, 300) })`);
    if (/grounded/.test(dk.via)) console.log(`[${size.name}] off-topic via LLM → ${dk.text}`);
    else if (!dk.local) problems.push(`[${size.name}] off-topic question did not get the honest don't-know`);
    await cdp.shot(path.join(OUT, `${size.name}-98-dontknow.png`));

    // a muted run must never reach ElevenLabs or the LLM's voice — prove it
    const net = await cdp.eval(`performance.getEntriesByType('resource').filter(e => /elevenlabs/.test(e.name)).length`);
    if (net > 0) problems.push(`[${size.name}] muted run still made ${net} ElevenLabs request(s)`);

    // light theme, on the data scene
    await cdp.eval(`document.querySelector('#ansClose').click(); document.documentElement.dataset.theme = 'light'; window.app.goto('data', { play: false }); true`);
    await sleep(500);
    await cdp.shot(path.join(OUT, `${size.name}-97-light-data.png`));
    await cdp.eval(`document.documentElement.dataset.theme = 'dark'; true`);

    /* ── the interactions, once ──────────────────────────────────────── */
    if (size === SIZES[0]) {
      const expect = (ok, what) => { if (!ok) problems.push(`[${size.name}] interaction: ${what}`); };

      // keyboard: / focuses the ask bar, Escape blurs it, → and ← move scenes, space toggles play
      await cdp.eval(`window.app.goto('open', { play: false }); document.activeElement.blur(); true`);
      await key('/');
      expect(await cdp.eval(`document.activeElement === document.querySelector('#askInput')`), '"/" did not focus the ask bar');
      await key('Escape');
      expect(await cdp.eval(`document.activeElement !== document.querySelector('#askInput')`), 'Escape did not leave the ask bar');
      await key('ArrowRight');
      expect(await cdp.eval(`window.app.i === 1`), '→ did not advance a scene');
      await key('ArrowLeft');
      expect(await cdp.eval(`window.app.i === 0`), '← did not go back a scene');
      await key(' ');
      expect(await cdp.eval(`window.app.playing === true`), 'space did not start playing');
      await key(' ');
      expect(await cdp.eval(`window.app.playing === false`), 'space did not pause');

      // tour-map stop and chooser buttons navigate
      await cdp.eval(`window.app.goto('open', { play: false }); document.querySelector('.stop[data-goto="data"]').click(); true`);
      expect(await cdp.eval(`window.app.i === 3 && window.app.playing === true`), 'tour stop did not open "All the data" playing');
      await cdp.eval(`window.app.pause(); window.app.goto('start', { play: false }); document.querySelector('.chooser [data-goto="airis"]').click(); true`);
      expect(await cdp.eval(`window.app.i === 8`), 'chooser did not open the AIRIS scene');
      await cdp.eval(`window.app.pause(); true`);

      // a question while playing: pauses, offers resume; resume plays again
      await cdp.eval(`window.app.goto('model', { play: true }); window.app.handleAsk('What is the return on investment?'); true`);
      await waitFor(`!!document.querySelector('#ansBody [data-resume]')`);
      expect(await cdp.eval(`window.app.playing === false`), 'a question did not pause the walkthrough');
      expect(await cdp.eval(`!!document.querySelector('#ansBody [data-resume]')`), 'no resume button after interrupting the walkthrough');
      await cdp.eval(`document.querySelector('#ansBody [data-resume]').click(); true`);
      expect(await cdp.eval(`window.app.playing === true && !document.querySelector('#answer').classList.contains('open')`), 'resume did not restart the walkthrough and close the sheet');
      await cdp.eval(`window.app.pause(); true`);

      // jump button goes to the answer's scene; related chip asks a new question
      await cdp.eval(`window.app.goto('open', { play: false }); window.app.handleAsk('What is AIRIS and what did the demo show?'); true`);
      await waitFor(`!!document.querySelector('#ansBody [data-jump]')`);
      expect(await cdp.eval(`document.querySelector('#ansBody [data-jump]')?.dataset.jump === 'airis'`), 'jump button does not point at the AIRIS scene');
      const firstRelated = await cdp.eval(`document.querySelector('#ansFigs .also button')?.textContent || ''`);
      await cdp.eval(`document.querySelector('#ansFigs .also button')?.click(); true`);
      await waitFor(`document.querySelector('#ansQ').textContent === ${JSON.stringify(firstRelated)} && !!document.querySelector('#ansBody .ans-src')`);
      expect(await cdp.eval(`document.querySelector('#ansQ').textContent === ${JSON.stringify(firstRelated)}`), 'related chip did not ask its question');
      await cdp.eval(`document.querySelector('#ansBody [data-jump]')?.click(); true`);
      expect(await cdp.eval(`!document.querySelector('#answer').classList.contains('open')`), 'jump did not close the answer sheet');
      await cdp.eval(`window.app.pause(); true`);

      // the "questions I get asked most" buttons on the last scene
      await cdp.eval(`window.app.goto('talk', { play: false }); document.querySelector('.chooser [data-q]').click(); true`);
      expect(await waitFor(`document.querySelector('#answer').classList.contains('open') && !!document.querySelector('#ansBody .ans-src')`), 'talk-scene question button did not answer');
      await cdp.eval(`document.querySelector('#ansClose').click(); true`);

      // theme toggle persists; mute toggles the voice; mic button state is sane
      await cdp.eval(`document.querySelector('#themeBtn').click(); true`);
      expect(await cdp.eval(`document.documentElement.dataset.theme === 'light' && localStorage.getItem('aib-theme') === 'light'`), 'theme toggle did not persist light');
      await cdp.eval(`document.querySelector('#themeBtn').click(); true`);
      expect(await cdp.eval(`document.documentElement.dataset.theme === 'dark'`), 'theme toggle did not return to dark');
      await cdp.eval(`window.app.voice.setMuted(false); document.querySelector('#muteBtn').click(); true`);
      expect(await cdp.eval(`window.app.voice.muted === true && document.querySelector('#muteBtn').getAttribute('aria-pressed') === 'false'`), 'mute button did not mute');
      await cdp.eval(`document.querySelector('#muteBtn').click(); window.app.voice.setMuted(true); true`);
      expect(await cdp.eval(`document.querySelector('#micBtn').disabled === !((window.AIB_CONFIG?.elevenLabs?.apiKey && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) || window.SpeechRecognition || window.webkitSpeechRecognition)`), 'mic button enabled state does not match browser support');

      // the microphone holds while listening and the cancel control cancels it (fake mic in headless)
      const micKind = await cdp.eval(`document.querySelector('#micBtn').disabled ? '' : (document.querySelector('#micBtn').dataset.kind || '')`);
      if (micKind === 'webspeech') {
        // no ElevenLabs key: the browser's own recognition. Headless Brave has no speech service,
        // so the honest outcome is a spoken explanation, never a silent un-toggle.
        await cdp.eval(`document.querySelector('#micBtn').click(); true`);
        await sleep(2500);
        expect(await cdp.eval(`!document.querySelector('#micBtn').classList.contains('rec') && /type it in|microphone|speech service|didn.t catch/i.test(document.querySelector('#captionText').textContent)`), 'web-speech failure was not explained in the caption');
      }
      if (micKind === 'scribe') {
        await cdp.eval(`document.querySelector('#micBtn').click(); true`);
        await sleep(1500);
        expect(await cdp.eval(`document.querySelector('#micBtn').classList.contains('rec') && !document.querySelector('#micCancel').hidden`), 'mic did not hold the listening state for 1.5 s');
        await cdp.eval(`document.querySelector('#micCancel').click(); true`);
        await sleep(400);
        expect(await cdp.eval(`!document.querySelector('#micBtn').classList.contains('rec') && document.querySelector('#micCancel').hidden && /cancelled/i.test(document.querySelector('#captionText').textContent)`), 'cancel did not stop listening');
        const stt = await cdp.eval(`performance.getEntriesByType('resource').filter(e => /speech-to-text/.test(e.name)).length`);
        expect(stt === 0, `cancel still sent ${stt} transcription request(s)`);
      }

      // the settings panel opens from the gear, closes on Escape; the voice switch lives inside it
      await cdp.eval(`document.querySelector('#settingsBtn').click(); true`);
      expect(await cdp.eval(`!document.querySelector('#settings').hidden && document.querySelector('#settingsBtn').getAttribute('aria-expanded') === 'true'`), 'settings panel did not open');
      await sleep(300);
      await cdp.shot(path.join(OUT, `${size.name}-95-settings.png`));
      const seg = await cdp.eval(`!document.querySelector('#voiceSeg').hidden`);
      if (seg) {
        await cdp.eval(`window.app.voice.setMuted(true); document.querySelector('#voiceSeg [data-persona="jarvis"]').click(); true`);
        expect(await cdp.eval(`window.app.voice.persona === 'jarvis' && localStorage.getItem('aib-voice') === 'jarvis' && document.querySelector('#voiceSeg [data-persona="jarvis"]').getAttribute('aria-pressed') === 'true'`), 'voice switch did not select Jarvis');
        expect(await cdp.eval(`!document.querySelector('#settings').hidden`), 'switching the voice closed the settings panel');
        await cdp.eval(`document.querySelector('#voiceSeg [data-persona="friday"]').click(); true`);
        expect(await cdp.eval(`window.app.voice.persona === 'friday'`), 'voice switch did not return to Friday');
      } else {
        expect(await cdp.eval(`document.querySelector('#voiceNote').textContent.length > 10`), 'keyless build shows no voice note in settings');
      }
      await key('Escape');
      expect(await cdp.eval(`document.querySelector('#settings').hidden`), 'Escape did not close the settings panel');
      await cdp.eval(`document.querySelector('#settingsBtn').click(); true`);
      await cdp.eval(`document.querySelector('#stage').click(); true`);
      expect(await cdp.eval(`document.querySelector('#settings').hidden`), 'a click outside did not close the settings panel');

      // the workflow run and the AIRIS run both reach their end state and clean up on leave
      await cdp.eval(`window.app.goto('live', { play: false }); document.querySelector('#runBtn').click(); true`);
      expect(await waitFor(`document.querySelector('#runStatus').textContent.includes('WAITING FOR A HUMAN')`, 8000), 'workflow run never reached the human step');
      await cdp.eval(`window.app.goto('airis', { play: false }); document.querySelector('#airisBtn').click(); true`);
      expect(await waitFor(`document.querySelector('#airisClock').textContent === '83' && document.querySelectorAll('#airisPersonas .persona.lit').length === 5`, 9000), 'AIRIS run did not finish at 83 s with all five personas lit');
      await cdp.eval(`window.app.goto('open', { play: false }); true`);
      await sleep(1500);   // any leaked timer would throw here (its elements are gone)

      // narration loop advances to the next scene on its own (muted, so fast)
      await cdp.eval(`window.app.goto('start', { play: true }); true`);
      expect(await waitFor(`window.app.i === 2`, 15000), 'narration did not auto-advance from scene 2 to scene 3');
      expect(await waitFor(`window.app.i === 3 && window.app.playing === true`, 30000), 'narration stopped after advancing (the next scene was shown but not narrated)');
      await cdp.eval(`window.app.pause(); true`);

      // …and after the last scene it starts again from the first, still playing
      await cdp.eval(`window.app.goto('talk', { play: true }); true`);
      expect(await waitFor(`window.app.i === 0 && window.app.playing === true`, 40000), 'walkthrough did not loop from scene 13 back to scene 1');
      expect(await waitFor(`window.app.i === 1 && window.app.playing === true`, 40000), 'loop did not carry on past scene 1');
      await cdp.eval(`window.app.pause(); true`);

      // a film-strip click jumps straight there and plays from there; Next / Back wrap around
      await cdp.eval(`document.querySelectorAll('#sceneList .strip-item')[8].click(); true`);
      expect(await cdp.eval(`window.app.i === 8 && window.app.playing === true`), 'strip click did not jump to scene 9 and play');
      await cdp.eval(`window.app.pause(); window.app.goto('talk', { play: false }); document.querySelector('#skipBtn').click(); true`);
      expect(await cdp.eval(`window.app.i === 0`), 'Next on the last scene did not wrap to the first');
      await cdp.eval(`document.querySelector('#backBtn').click(); true`);
      expect(await cdp.eval(`window.app.i === 12`), 'Back on the first scene did not wrap to the last');
      await cdp.eval(`window.app.goto('open', { play: false }); true`);
      console.log(`[${size.name}] interactions: ${problems.filter(p => p.includes('interaction')).length} problem(s)`);
    }
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
