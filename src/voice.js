/* ============================================================================
   Voice.

   Two backends behind one interface:

     1. ElevenLabs — used whenever CONFIG.elevenLabs.apiKey is set AND the page
        is served from a host that is allowed to reach api.elevenlabs.io.
        Streams MP3, plays it through an AudioContext, and feeds real RMS to the
        avatar so the jaw follows actual speech rather than a text estimate.

     2. Web Speech (speechSynthesis) — the fallback. No key, no network, works
        offline. The avatar lip-syncs from the text instead.

   Both resolve the same promise when the line finishes, so the narration loop
   does not care which one ran. Both are interruptible.

   NOTE ON HOSTING: a published Claude Artifact runs under a strict CSP that
   blocks every external host, so ElevenLabs cannot be reached from there — the
   artifact always speaks with Web Speech. Serve this repo from your own host
   and the key takes over. That is a property of the preview, not of the build.
   ========================================================================== */

/* ElevenLabs premade "Rachel" — used when no voiceId is configured. */
const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';

/* ── proxy mode ───────────────────────────────────────────────────────
   On a hosted deployment the page carries no keys: `elevenLabs.proxy` is a
   same-origin base such as /api/eleven whose routes hold the key (see
   functions/). The visitor's access code travels in X-AIB-Pass; a 401 means
   it is missing or wrong, and the page is told so it can say so.         */
export function accessHeaders() {
  let pass = '';
  try { pass = localStorage.getItem('aib-pass') || ''; } catch {}
  return pass ? { 'X-AIB-Pass': pass } : {};
}
export function unauthorised(res) {
  if (res?.status !== 401) return false;
  try { window.dispatchEvent(new CustomEvent('aib:unauthorised')); } catch {}
  return true;
}

/* ── audio cache ──────────────────────────────────────────────────────
   A stand plays the same thirteen scenes all day. Every ElevenLabs call is
   billed per character, so each distinct line is fetched once and then
   replayed from memory — and from IndexedDB across reloads where the browser
   allows it (Chrome does on file:// and http://). Keyed on model, voice,
   settings and the text, so changing any of them fetches fresh audio.    */
const CLIPS = new Map();                                   // key → ArrayBuffer

const hashOf = str => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16) + '-' + str.length;
};

let clipDb = null;
function openClipStore() {
  if (clipDb) return clipDb;
  return clipDb = new Promise(resolve => {
    try {
      const rq = indexedDB.open('aib-voice', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('clips');
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => resolve(null);
      rq.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function clipGet(key) {
  const db = await openClipStore(); if (!db) return null;
  return new Promise(resolve => {
    try {
      const rq = db.transaction('clips', 'readonly').objectStore('clips').get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function clipPut(key, buf) {
  const db = await openClipStore(); if (!db) return;
  try { db.transaction('clips', 'readwrite').objectStore('clips').put(buf, key); } catch {}
}
const INFLIGHT = new Map();                                // key → Promise<ArrayBuffer>

/** Memory → in-flight request → IndexedDB → the network, in that order. A line
    that say(), prefetch() and prewarm() all want at once is fetched exactly once. */
function cachedClip(key, fetcher) {
  if (CLIPS.has(key)) return Promise.resolve(CLIPS.get(key));
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = (async () => {
    const stored = await clipGet(key);
    if (stored) { CLIPS.set(key, stored); return stored; }
    const buf = await fetcher();
    CLIPS.set(key, buf);
    clipPut(key, buf);
    return buf;
  })();
  INFLIGHT.set(key, p);
  return p.finally(() => INFLIGHT.delete(key));
}

export class Voice {
  constructor(config = {}) {
    this.cfg = config;
    this.muted = false;
    this.current = null;        // { cancel() }
    this.audioCtx = null;
    this.onLevel = null;        // (rms 0..1) => void
    this.voice = null;
    this._sayId = 0;            // bumped by every say() and stop(); a stale call sees a mismatch and goes quiet
    this.persona = this.cfg?.elevenLabs?.persona || Object.keys(this.cfg?.elevenLabs?.voices || {})[0] || null;
    this._pickVoice();
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get usingElevenLabs() {
    return Boolean(this.cfg?.elevenLabs?.apiKey || this.cfg?.elevenLabs?.proxy);
  }

  /** The switchable voices: [{ id, label, gender }]. Empty when none are configured. */
  get personas() {
    const v = this.cfg?.elevenLabs?.voices || {};
    return Object.entries(v).filter(([, p]) => p?.voiceId).map(([id, p]) => ({ id, label: p.label || id, gender: p.gender || '' }));
  }

  /** Switch voice. Clips are cached per voice, so switching back is free. */
  setPersona(id) {
    if (!this.cfg?.elevenLabs?.voices?.[id]) return false;
    this.persona = id;
    return true;
  }

  setMuted(m) { this.muted = m; if (m) this.stop(); }

  stop() {
    this._sayId++;
    if (this.current) { try { this.current.cancel(); } catch {} this.current = null; }
    if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
    this.onLevel?.(null);
  }

  /** Speak one line. Resolves when it finishes (or immediately when muted). */
  async say(text) {
    this.stop();
    const my = ++this._sayId;
    if (this.muted || !text) { await sleep(estimate(text) * 0.35); return; }
    if (this.usingElevenLabs) {
      try { return await this._elevenLabs(text, my); }
      catch (err) {
        // Cancelled, or superseded by a newer line while this one was still loading — stay silent.
        if (err?.name === 'AbortError' || my !== this._sayId) return;
        console.warn('[voice] ElevenLabs failed, falling back to Web Speech:', err?.message || err);
      }
    }
    if (my !== this._sayId) return;
    return this._webSpeech(text);
  }

  /* ── Web Speech ─────────────────────────────────────────────────────── */

  _pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    const want = this.cfg?.webSpeech?.voiceNameContains;
    const byName = want && vs.find(v => v.name.toLowerCase().includes(String(want).toLowerCase()));
    // Prefer a natural en-GB/en-AU voice; these read an aviation script far
    // better than the default robotic en-US on most machines.
    const preferred = [
      /google uk english female/i, /samantha/i, /serena/i, /karen/i, /moira/i,
      /google us english/i, /microsoft (aria|libby|sonia)/i,
    ];
    this.voice = byName
      || preferred.map(re => vs.find(v => re.test(v.name))).find(Boolean)
      || vs.find(v => /^en[-_]/i.test(v.lang))
      || vs[0];
  }

  _webSpeech(text) {
    if (!('speechSynthesis' in window)) return sleep(estimate(text));
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = this.cfg?.webSpeech?.rate ?? 0.98;
      u.pitch = this.cfg?.webSpeech?.pitch ?? 1.0;
      u.lang = this.voice?.lang || 'en-GB';
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // Chrome silently drops long utterances; guard so the deck never stalls.
      const guard = setTimeout(finish, estimate(text) + 4000);
      this.current = { cancel: () => { try { speechSynthesis.cancel(); } catch {} finish(); } };
      try { speechSynthesis.speak(u); } catch { finish(); }
    });
  }

  /* ── ElevenLabs ─────────────────────────────────────────────────────── */

  /** The request shape for one line: voice, model, settings and cache key. */
  _elSpec(text) {
    const el = this.cfg.elevenLabs;
    const persona = el.voices?.[this.persona] || {};
    // per-persona overrides sit on top of the shared settings
    const {
      apiKey, modelId = 'eleven_multilingual_v2',
      stability = 0.62, similarity = 0.80, style = 0.12, speed = 1.0,
    } = { ...el, ...persona };
    const voiceId = persona.voiceId || el.voiceId || DEFAULT_VOICE;
    // Eleven v3 accepts stability only as 0 / 0.5 / 1 and ignores the v2 knobs;
    // sending 0.7 or `style` gets a 400 and a silent fall back to the browser voice.
    const v3 = /^eleven_v3/.test(modelId);
    const voiceSettings = v3
      ? { stability: [0, 0.5, 1].reduce((best, x) => Math.abs(x - stability) < Math.abs(best - stability) ? x : best, 0.5) }
      : { stability, similarity_boost: similarity, style, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed)) };
    const key = `${modelId}|${voiceId}|${JSON.stringify(voiceSettings)}|${hashOf(text)}`;
    return { apiKey, voiceId, modelId, voiceSettings, key, proxy: el.proxy ? String(el.proxy).replace(/\/+$/, '') : '' };
  }

  /** Fetch (or serve from cache) the MP3 bytes for one line. */
  _elClip(text, controller) {
    const { apiKey, voiceId, modelId, voiceSettings, key, proxy } = this._elSpec(text);
    const url = proxy
      ? `${proxy}/tts/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
      : `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
    const auth = proxy ? accessHeaders() : { 'xi-api-key': apiKey };
    return cachedClip(key, async () => {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller?.signal,
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
      });
      if (!res.ok) { unauthorised(res); throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`); }
      return res.arrayBuffer();
    });
  }

  /** Warm the cache for a line without playing it. Silent on failure. */
  async prefetch(text) {
    if (!this.usingElevenLabs || this.muted || !text) return;
    try { await this._elClip(text, null); } catch {}
  }

  /** Warm the whole deck in the background, one line at a time, skipping what is cached.
      Stops quietly if the voice is muted meanwhile. Costs the characters of one run — once. */
  async prewarm(lines) {
    if (!this.usingElevenLabs || this.cfg?.elevenLabs?.prewarm === false) return;
    if (this._prewarming) return;
    this._prewarming = true;
    try {
      for (const line of lines) {
        if (this.muted) break;
        await this.prefetch(line);
      }
    } finally { this._prewarming = false; }
  }

  async _elevenLabs(text, my) {
    const controller = new AbortController();
    this.current = { cancel: () => controller.abort() };   // cancellable while still fetching
    const stale = () => controller.signal.aborted || my !== this._sayId;
    const buf = await this._elClip(text, controller);
    if (stale()) return;

    this.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    if (stale()) return;
    // decodeAudioData consumes the buffer it is given — hand it a copy, keep the cached one
    const decoded = await this.audioCtx.decodeAudioData(buf.slice(0));
    if (stale()) return;                                     // a cache hit decodes fast, but not instantly

    return new Promise(resolve => {
      const src = this.audioCtx.createBufferSource();
      src.buffer = decoded;

      // Real amplitude → the avatar's jaw. This is the whole reason for
      // decoding rather than using an <audio> element.
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser); analyser.connect(this.audioCtx.destination);

      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        this.onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
        raf = requestAnimationFrame(tick);
      };
      tick();

      let done = false;
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf); this.onLevel?.(null);
        try { src.disconnect(); analyser.disconnect(); } catch {}
        resolve();
      };
      // If the audio device never fires `ended` (a suspended context on a locked venue box),
      // finish anyway a little after the clip's real length so the narration never stalls.
      const guard = setTimeout(finish, decoded.duration * 1000 + 2500);
      const finishAll = () => { clearTimeout(guard); finish(); };
      src.onended = finishAll;
      this.current = { cancel: () => { controller.abort(); try { src.stop(); } catch {} finishAll(); } };
      src.start();
    });
  }
}

/** Rough read-aloud duration, used when nothing can tell us the real one. */
export function estimate(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round(words / 2.55 * 1000));   // ~153 wpm
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── speech-to-text for the Ask box ───────────────────────────────────
   Two ears, one interface:

     1. ElevenLabs Scribe — used whenever an ElevenLabs key is configured.
        The page records the microphone (MediaRecorder), stops on ~1.2 s of
        silence or a tap, and posts the clip to /v1/speech-to-text. Works in
        every browser, including the ones whose built-in recognition has no
        speech service (Brave, offline Chrome, most kiosks).

     2. Web Speech (SpeechRecognition) — the fallback with no key. Chrome
        only in practice, and it needs Google's service to be reachable.

   Both call onResult(text, final) then onEnd(); a failure calls onError with
   a sentence AIRIS can say out loud, so a dead microphone is never silent. */

const MIC_MESSAGES = {
  NotAllowedError: 'The microphone is blocked. Allow it in the address bar and try again.',
  'not-allowed': 'The microphone is blocked. Allow it in the address bar and try again.',
  'service-not-allowed': 'This browser’s speech service isn’t available. Chrome works best — or type it in and I’ll answer.',
  NotFoundError: 'I can’t find a microphone on this machine — type it in and I’ll answer.',
  'audio-capture': 'I can’t find a microphone on this machine — type it in and I’ll answer.',
  network: 'This browser’s speech service isn’t reachable. Type it in and I’ll answer.',
  'no-speech': 'I didn’t catch anything — try again, a little closer to the mic.',
  aborted: 'Okay, cancelled.',
};
const micMessage = code => MIC_MESSAGES[code] || 'I couldn’t hear that just now — type it in and I’ll answer.';

export function createRecogniser(config = {}, { onResult, onEnd, onError, onStatus } = {}) {
  const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.FormData);
  const hasEars = Boolean(config?.elevenLabs?.apiKey || config?.elevenLabs?.proxy);
  if (hasEars && canRecord) return scribeRecogniser(config.elevenLabs, { onResult, onEnd, onError, onStatus });
  if (hasEars && !canRecord) {
    // The key is there but this page cannot open a microphone (usually a file:// or plain-http
    // page in a browser that only allows the mic on https / localhost). Say so, out loud.
    const why = window.isSecureContext
      ? 'This browser can’t record here — open the page in Chrome, Brave or Edge.'
      : 'The microphone only works on https or localhost — open the localhost link instead of the file.';
    console.warn('[mic] recording unavailable:', { secure: window.isSecureContext, mediaDevices: !!navigator.mediaDevices, MediaRecorder: !!window.MediaRecorder });
    return { kind: 'unavailable', start: () => { onError?.(why); }, stop: () => {}, cancel: () => {} };
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  return webSpeechRecogniser(SR, { onResult, onEnd, onError });
}

function webSpeechRecogniser(SR, { onResult, onEnd, onError }) {
  const r = new SR();
  r.lang = 'en-GB';
  r.interimResults = true;
  r.continuous = false;
  let failed = false;
  r.onresult = e => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      e.results[i].isFinal ? (final += t) : (interim += t);
    }
    onResult?.(final || interim, Boolean(final));
  };
  r.onerror = e => { failed = true; onError?.(micMessage(e?.error)); };
  r.onend = () => { if (!failed) onEnd?.(); failed = false; };
  return { kind: 'webspeech', start: () => r.start(), stop: () => r.stop() };
}

function scribeRecogniser(el, { onResult, onEnd, onError, onStatus }) {
  const MAX_MS = 10000, SILENCE_MS = 1200, MIN_MS = 500, THRESH = 0.02;
  let rec = null, stream = null, ctx = null, timers = [], stopping = false, cancelled = false;

  const pickType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';

  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const teardown = () => {
    clear();
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { ctx?.close(); } catch {}
    stream = null; ctx = null; rec = null; stopping = false;
  };

  async function transcribe(blob) {
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append('file', blob, blob.type.includes('mp4') ? 'clip.mp4' : blob.type.includes('ogg') ? 'clip.ogg' : 'clip.webm');
    const proxy = el.proxy ? String(el.proxy).replace(/\/+$/, '') : '';
    const res = await fetch(proxy ? `${proxy}/stt` : 'https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST', headers: proxy ? accessHeaders() : { 'xi-api-key': el.apiKey }, body: form,
    });
    if (!res.ok) { unauthorised(res); throw new Error(`Scribe ${res.status}: ${(await res.text()).slice(0, 120)}`); }
    const data = await res.json();
    return String(data.text || '').trim();
  }

  async function start() {
    cancelled = false;
    // Create the analyser's AudioContext now, inside the click, so it is allowed to run;
    // created after an await it can sit "suspended" and never hear you go quiet.
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch { ctx = null; }
    console.info('[mic] opening microphone…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      console.warn('[mic] getUserMedia failed:', err?.name, err?.message);
      onError?.(micMessage(err?.name)); teardown(); return;
    }
    if (cancelled) { teardown(); return; }
    console.info('[mic] recording', stream.getAudioTracks()[0]?.label || '');

    const chunks = [];
    const type = pickType();
    try { rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream); }
    catch (err) { onError?.(micMessage(err?.name)); teardown(); return; }
    rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    const startedAt = performance.now();

    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec?.mimeType || type || 'audio/webm' });
      const heard = performance.now() - startedAt;
      teardown();
      console.info(`[mic] stopped after ${Math.round(heard)} ms, ${blob.size} bytes${cancelled ? ' (cancelled)' : ''}`);
      if (cancelled) { onEnd?.(); return; }
      if (heard < MIN_MS || blob.size < 1500) { onError?.(micMessage('no-speech')); return; }
      onStatus?.('Got it — one second.');
      try {
        const text = await transcribe(blob);
        console.info('[mic] heard:', text);
        if (!text) { onError?.(micMessage('no-speech')); return; }
        onResult?.(text, true);
        onEnd?.();
      } catch (err) {
        console.warn('[mic] transcription failed:', err?.message || err);
        onError?.('I couldn’t transcribe that just now — type it in and I’ll answer.');
      }
    };

    // silence detection: stop ~1.2 s after the visitor stops talking, once they have started
    try {
      if (!ctx) throw new Error('no AudioContext');
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      let spoke = false, quietSince = 0;
      const poll = () => {
        if (!rec || stopping) return;
        an.getByteTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (rms > THRESH) { spoke = true; quietSince = 0; }
        else if (spoke) { quietSince ||= now; if (now - quietSince > SILENCE_MS) { stop(); return; } }
        timers.push(setTimeout(poll, 100));
      };
      poll();
    } catch {}
    timers.push(setTimeout(stop, MAX_MS));

    rec.start(250);
    onStatus?.('I’m listening — go ahead.');
  }

  function stop() {
    if (!rec || stopping) return;
    stopping = true; clear();
    try { rec.state !== 'inactive' ? rec.stop() : rec.onstop?.(); } catch { teardown(); onEnd?.(); }
  }

  function cancel() { cancelled = true; stop(); }

  return { kind: 'scribe', start, stop, cancel };
}
