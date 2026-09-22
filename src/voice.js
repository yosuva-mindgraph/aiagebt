/* ============================================================================
   Voice.

   Three backends behind one interface, tried in this order:

     0. PRE-RENDERED — clips baked into the build by tools/prerender-voice.mjs
        and inlined as window.AIB_VOICE_CLIPS. Real ElevenLabs audio with real
        word timings, decoded from base64 that is already in the page. No key,
        no network, no account. This is what the booth pod, the emailed file and
        a published artifact all get, and it is why they stopped sounding
        robotic. Checked FIRST, always — a clip on disk beats a round trip.

     1. LIVE ElevenLabs — for text nobody pre-rendered, which is chiefly an LLM
        answer, written at the moment it is asked. Fetches MP3, plays it through
        an AudioContext, and feeds real RMS to the avatar so the jaw follows
        actual speech rather than a text estimate. Reached two ways:

          1a. CONFIG.elevenLabs.endpoint — a same-origin proxy holding the key
              server-side. POST {text}; it answers ElevenLabs' /with-timestamps
              JSON unmodified, so nothing below the fetch can tell the
              difference. This is what anything public should use, and it is
              the only one of the two that leaves no key in the page.
          1b. CONFIG.elevenLabs.apiKey + voiceId — the key in the browser,
              calling api.elevenlabs.io directly. A laptop on a stand, not the
              internet.

        An endpoint wins over a key when both are set: there is no reason to
        send a credential the proxy already holds.

     2. Web Speech (speechSynthesis) — the fallback. No key, no network, works
        offline. The avatar lip-syncs from the text instead.

   All three resolve the same promise when the line finishes, so the narration
   loop does not care which one ran. All three are interruptible.

   ── why the lookup is keyed by the TEXT ───────────────────────────────────
   A pre-rendered clip is addressed by a hash of the EXACT string that was
   spoken (voiceClipKey below). Edit a narration line and its clip simply goes
   missing, so that line falls through to the live path or to Web Speech. The
   alternative — keying by scene id and line index — would keep playing
   yesterday's audio under today's caption, silently, with no error anywhere.
   Missing audio is a fallback; wrong audio is a lie told to a room.

   ── the fetch/play seam ──────────────────────────────────────────────────
   Fetching and playing used to be one method. They are now separate:

       synthesize(text)  → Clip | null   fetch + decode + word timings
       play(clip)        → Promise       play it here, RMS → onLevel
       speakBrowser(text)→ Promise       the Web Speech fallback, on its own
       useAudioContext(ctx)              adopt an AudioContext made elsewhere

   say() still does fetch-then-play and behaves exactly as it always has; it is
   simply written in terms of those now. The seam exists for the 3D avatar
   (met4citizen/TalkingHead), which drives visemes off its OWN audio clock and
   therefore has to do the playing itself. The only thing that crosses that
   line is a Clip:

       { audioBuffer: AudioBuffer,   // decoded, in THIS Voice's AudioContext
         words: string[],            // spoken words, in order
         wtimes: number[],           // word start, integer MILLISECONDS
         wdurations: number[],       // word length, integer MILLISECONDS
         durationMs: number }        // whole clip, integer milliseconds

   words / wtimes / wdurations are always the same length (possibly zero, if
   ElevenLabs sent no usable alignment — the audio still plays).

   NOTE ON HOSTING: a published Claude Artifact runs under a strict CSP that
   blocks every external host, so ElevenLabs cannot be reached from there — the
   artifact always speaks with Web Speech. Serve this repo from your own host
   and the key takes over. That is a property of the preview, not of the build.
   ========================================================================== */

/** How long a live TTS fetch may hang before the line goes to Web Speech.
    Reasoned about at the call site in synthesize(); override with
    `elevenLabs.timeoutMs`. */
export const TTS_TIMEOUT_MS = 12000;

export class Voice {
  constructor(config = {}) {
    this.cfg = config;
    this.muted = false;
    this.current = null;        // { cancel() }
    this.audioCtx = null;
    this.onLevel = null;        // (rms 0..1) => void
    this.voice = null;
    this._ownsCtx = false;      // did WE make audioCtx? only then may we close it
    this._epoch = 0;            // bumped by stop(); lets an in-flight say() bail
    this._warnedNoKey = false;
    this._warnedNoAlign = false;
    /* Decoded pre-rendered clips, keyed by voiceClipKey. An AudioBuffer belongs
       to the context that decoded it, so this is dropped whenever the context
       changes — see useAudioContext. */
    this._preCache = new Map();
    this._pickVoice();
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  /** Is there an ElevenLabs KEY IN THIS BROWSER? Narrow on purpose — see below. */
  get usingElevenLabs() {
    return Boolean(this.cfg?.elevenLabs?.apiKey && this.cfg?.elevenLabs?.voiceId);
  }

  /* ── why this is a SECOND getter and not a wider first one ───────────────
     Both answer "can this build reach ElevenLabs", and they are still not the
     same question. usingElevenLabs means `a key is sitting in this page`, and
     that is the fact the deliverable is checked against: tests/degrade and
     tests/voice both assert it is FALSE on dist/index.html, which is how the
     build proves it shipped no credential. Widen it to cover a proxy and that
     assertion stops meaning anything — it would read false-for-no-key and
     true-for-no-key-but-a-URL, so a key leaking into the build would no longer
     be distinguishable from the safe configuration.

     The proxy is the opposite arrangement: the key exists, deliberately, and
     deliberately not here. So it gets its own name. */

  /** Is a same-origin TTS proxy configured — a key somewhere else, not here? */
  get usingTTSProxy() {
    return Boolean(this.cfg?.elevenLabs?.endpoint);
  }

  /** How many pre-rendered clips this build carries. 0 on a build with none. */
  get prerenderedCount() {
    return Object.keys(prerenderedClips()).length;
  }

  setMuted(m) { this.muted = m; if (m) this.stop(); }

  stop() {
    this._epoch++;
    if (this.current) { try { this.current.cancel(); } catch {} this.current = null; }
    if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
    this.onLevel?.(null);
  }

  /** Speak one line. Resolves when it finishes (or immediately when muted). */
  async say(text) {
    this.stop();
    if (this.muted || !text) { await sleep(estimate(text) * 0.35); return; }

    const my = this._epoch;
    const clip = await this.synthesize(text);        // null = no key / failed
    // stop() landed while we were fetching: do not start talking after a stop.
    if (my !== this._epoch) return;
    if (clip && await this._play(clip)) return;
    if (my !== this._epoch || this.muted) return;
    return this.speakBrowser(text);
  }

  /* ── audio context ──────────────────────────────────────────────────── */

  /**
   * Adopt an AudioContext created elsewhere.
   *
   * TalkingHead 1.7.0 builds its own context inside initAudioGraph() and gives
   * you nowhere to inject one (`grep -c "audioCtx:"` → 0). If Voice decodes in
   * its own context and TalkingHead plays in another, every clip is resampled
   * across the boundary — so Voice adopts theirs instead. Any context we made
   * ourselves is ours to close: an orphaned AudioContext keeps an output device
   * open and browsers cap how many you may hold (~6 in Chrome), so leaking one
   * per handover eventually throws.
   */
  useAudioContext(ctx) {
    if (!ctx || ctx === this.audioCtx) return this.audioCtx;
    const orphan = this._ownsCtx ? this.audioCtx : null;
    this.stop();                        // whatever is playing belongs to the old ctx
    this.audioCtx = ctx;
    this._ownsCtx = false;
    // Every cached AudioBuffer was decoded in the context we just let go of.
    // Playing one in the new context resamples it across the boundary, which is
    // the whole thing this handover exists to avoid.
    this._preCache.clear();
    if (orphan) { try { orphan.close(); } catch {} }
    return this.audioCtx;
  }

  /** Lazily make an AudioContext, remembering that it is ours to close. */
  _ctx() {
    if (this.audioCtx) return this.audioCtx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    this.audioCtx = new AC();
    this._ownsCtx = true;
    return this.audioCtx;
  }

  /* ── pre-rendered clips ─────────────────────────────────────────────── */

  /**
   * The clip this build already carries for this exact text, or null.
   *
   * Returns the SAME Clip shape the ElevenLabs path returns, so Presenter and
   * both avatar backends cannot tell the difference — which is the point: this
   * whole feature is one lookup in front of synthesize(), and nothing
   * downstream of it changed.
   *
   * Never throws. A payload that is missing, malformed, or fails to decode is a
   * miss, and a miss falls through to whatever the build can still do.
   */
  async prerendered(text) {
    const key = voiceClipKey(text);
    const rec = prerenderedClips()[key];
    if (!rec) return null;

    const cached = this._preCache.get(key);
    if (cached) return cached;

    try {
      const ctx = this._ctx();
      if (!ctx) return null;
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
      const data = base64ToBytes(rec.a);
      if (!data.length) return null;
      const audioBuffer = await ctx.decodeAudioData(data.buffer);

      const clip = {
        audioBuffer,
        ...timingsOf(rec),
        durationMs: Math.round(audioBuffer.duration * 1000),
      };
      this._preCache.set(key, clip);
      return clip;
    } catch (err) {
      console.warn('[voice] a pre-rendered clip would not decode:', err?.message || err);
      return null;
    }
  }

  /* ── ElevenLabs: synthesize ─────────────────────────────────────────── */

  /**
   * Turn one line into a Clip: pre-rendered if this build carries it, otherwise
   * fetched from ElevenLabs.
   *
   * Resolves null — never throws — when muted, when nothing is pre-rendered and
   * there is no key, or on any HTTP/decode failure, with one console.warn, so
   * every caller can fall back to Web Speech the way say() always has.
   */
  async synthesize(text) {
    if (this.muted || !text) return null;

    /* Step 0, before any thought of the network. On the shipped file this is
       the ONLY step that ever runs. */
    const baked = await this.prerendered(text);
    if (baked) return baked;

    const viaProxy = this.usingTTSProxy;
    if (!viaProxy && !this.usingElevenLabs) {
      // Keyless is the normal artifact case, not a fault — say it once per
      // Voice rather than once per line, or the console fills with it. It now
      // means "this text was not pre-rendered EITHER", which on a voiced build
      // is only ever an answer a model just wrote.
      if (!this._warnedNoKey) {
        this._warnedNoKey = true;
        console.warn('[voice] no pre-rendered clip and no ElevenLabs key — Web Speech for this line.');
      }
      return null;
    }

    const {
      endpoint, apiKey, voiceId, modelId = 'eleven_turbo_v2_5',
      stability = 0.42, similarity = 0.80, timeoutMs = TTS_TIMEOUT_MS,
    } = this.cfg.elevenLabs;

    const controller = new AbortController();
    // Registering the abort HERE, not only at playback, is what lets stop()
    // interrupt a line that is still in flight.
    const inflight = { cancel: () => { try { controller.abort(); } catch {} } };
    this.current = inflight;
    /* A deadline on the same abort. A refused connection rejects at once; a
       proxy that accepts and then WEDGES never rejects, and an unresolved
       synthesize() leaves say() awaiting forever — Iris stuck on "speaking"
       with nothing coming out and no way back but a reload. Aborting lands in
       the catch below, which already returns null, so a wedged proxy costs one
       wait and then speaks the line with Web Speech like any other failure.
       Shorter than the answer's own deadline because this is text that ALREADY
       exists: nothing is being written, only read aloud. */
    const timer = setTimeout(() => { try { controller.abort(); } catch {} }, timeoutMs);

    try {
      /* ── proxy first, then the direct keyed call ──────────────────────────
         Same response shape either way: the proxy is expected to hand back
         ElevenLabs' /with-timestamps JSON unmodified, so everything below this
         fetch is indifferent to which one ran. `endpoint` is relative
         ('/api/tts'), so no key, no CORS, and no hostname baked into a build
         that gets served from a different address every time it restarts.

         The voice, the model and the voice settings are the proxy's to choose,
         not a public page's — the operator pays for them. So the proxy body is
         the text and nothing else, and voiceId is not even in the URL. */
      const res = await fetch(
        viaProxy
          ? endpoint
          : `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
            `/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: viaProxy
            ? { 'Content-Type': 'application/json' }
            : { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(viaProxy ? { text } : {
            text,
            model_id: modelId,
            voice_settings: { stability, similarity_boost: similarity, use_speaker_boost: true },
          }),
        }
      );
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);

      // /with-timestamps answers JSON, not audio bytes: the MP3 comes back
      // base64 in audio_base64, with the character alignment beside it.
      const payload = await res.json();
      const bytes = base64ToBytes(payload?.audio_base64);
      if (!bytes.length) throw new Error('ElevenLabs returned no audio_base64');

      const ctx = this._ctx();
      if (!ctx) throw new Error('no AudioContext available');
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

      const { words, wtimes, wdurations } = wordsFromAlignment(pickAlignment(payload));
      if (!words.length && !this._warnedNoAlign) {
        this._warnedNoAlign = true;
        console.warn('[voice] ElevenLabs sent no usable alignment — clips will play without word timings.');
      }

      return {
        audioBuffer,
        words, wtimes, wdurations,
        durationMs: Math.round(audioBuffer.duration * 1000),
      };
    } catch (err) {
      /* An abort is either stop() interrupting a line — routine — or the
         deadline above. Both end the same way; naming the deadline is what
         stops a wedged proxy reading as a user cancel in the console. */
      const why = err?.name === 'AbortError' ? `aborted (deadline ${timeoutMs} ms, or stopped)` : (err?.message || err);
      console.warn('[voice] ElevenLabs failed, falling back to Web Speech:', why);
      return null;
    } finally {
      clearTimeout(timer);
      if (this.current === inflight) this.current = null;
    }
  }

  /* ── playback ───────────────────────────────────────────────────────── */

  /**
   * Play a Clip, resolving when it ends. Always settles; never throws.
   * (TalkingHead plays its own clips — nothing here assumes Voice is the only
   * player, so play() takes a Clip rather than re-fetching one.)
   */
  async play(clip) { await this._play(clip); }

  /** The real one. Resolves true only if the clip actually reached the speakers. */
  async _play(clip) {
    if (this.muted || !clip?.audioBuffer) return false;
    const ctx = this._ctx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
    if (ctx.state === 'closed') return false;      // someone closed it under us

    return new Promise(resolve => {
      let src, analyser;
      try {
        src = ctx.createBufferSource();
        src.buffer = clip.audioBuffer;

        // Real amplitude → the avatar's jaw. This is the whole reason for
        // decoding rather than using an <audio> element.
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser); analyser.connect(ctx.destination);
      } catch (err) {
        console.warn('[voice] could not start playback:', err?.message || err);
        resolve(false);            // caller falls back to Web Speech
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
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
        clearTimeout(guard);
        cancelAnimationFrame(raf); this.onLevel?.(null);
        try { src.disconnect(); analyser.disconnect(); } catch {}
        resolve(true);
      };
      src.onended = finish;
      // Belt and braces, as on the Web Speech side: a context that gets
      // suspended mid-line never fires onended, and one unresolved line stalls
      // the whole deck.
      const guard = setTimeout(finish, (clip.durationMs || Math.round(clip.audioBuffer.duration * 1000)) + 3000);
      this.current = { cancel: () => { try { src.stop(); } catch {} finish(); } };
      src.start();
    });
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

  /** Speak one line with the browser's own synthesiser. Resolves when done. */
  speakBrowser(text) {
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
}

/* ── pre-rendered clips: the address, and the payload ──────────────────── */

/**
 * The address of a pre-rendered clip: a hash of the EXACT string to be spoken.
 *
 * ── this function is a CONTRACT, not an implementation detail ──
 * tools/prerender-voice.mjs imports THIS function to name the files it writes,
 * so the build and the runtime cannot disagree about where a clip lives. Change
 * the arithmetic and every existing clip is orphaned at once — which is safe
 * (every line falls back) but throws away an hour of rendering, so change it
 * deliberately or not at all.
 *
 * FNV-1a, twice, over UTF-16 code units, rendered base36. Deliberately NOT
 * crypto.subtle: that is asynchronous, it is gated on a secure context, and
 * this is called on every line of narration. Nothing here is defending against
 * an adversary — it is naming 111 strings, and a 64-bit space does that with
 * room to spare. The generator asserts the keys it produced are distinct, so a
 * collision is a build failure rather than a clip playing under the wrong line.
 */
export function voiceClipKey(text) {
  const s = String(text ?? '');
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(36).padStart(7, '0') + h2.toString(36).padStart(7, '0');
}

/**
 * The clip table this build carries, or an empty object.
 *
 * build.js emits window.AIB_VOICE_CLIPS immediately before the app, from
 * assets/voice-clips.js, exactly as it emits window.AIB_AVATAR_GLB_B64. A build
 * with no clips has no such global and everything below reads as a miss.
 */
function prerenderedClips() {
  const g = typeof window !== 'undefined' ? window.AIB_VOICE_CLIPS : null;
  return (g && typeof g === 'object' && g.clips) || {};
}

/**
 * A stored record's word timings, in the shape wordsFromAlignment() returns.
 *
 * The generator ran the alignment through wordsFromAlignment() ONCE, offline,
 * and stored the result — so there is exactly one character-seconds to
 * word-milliseconds converter in this repo and this is not a second one. The
 * three arrays travel as delimited strings because 5,500 words of JSON arrays
 * cost about a hundred kilobytes more than 5,500 words of comma-separated
 * digits, and this payload is already the largest thing in the file.
 */
function timingsOf(rec) {
  const words = String(rec?.w || '').split(' ').filter(Boolean);
  const nums = s => String(s || '').split(',').filter(t => t !== '').map(Number);
  const wtimes = nums(rec?.t);
  const wdurations = nums(rec?.d);
  // Equal lengths or nothing: the avatar schedules off all three by index, and
  // a ragged set is worse than no timings at all.
  if (words.length !== wtimes.length || words.length !== wdurations.length) {
    return { words: [], wtimes: [], wdurations: [] };
  }
  return { words, wtimes, wdurations };
}

/* ── alignment → word timings ──────────────────────────────────────────── */

/**
 * Which alignment block to read.
 *
 * ElevenLabs returns `alignment` (keyed to the characters you SENT) and
 * `normalized_alignment` (keyed to the characters it actually SPOKE — "2025"
 * read as "twenty twenty-five", "Dr." as "doctor"). The avatar needs the words
 * that were spoken, so normalized_alignment wins whenever it is well formed;
 * `alignment` is the fallback, and its word boundaries smear wherever the input
 * contained digits or abbreviations. Exported for tests.
 */
export function pickAlignment(payload) {
  const ok = a => a
    && Array.isArray(a.characters)
    && Array.isArray(a.character_start_times_seconds)
    && Array.isArray(a.character_end_times_seconds)
    && a.characters.length > 0
    && a.characters.length === a.character_start_times_seconds.length
    && a.characters.length === a.character_end_times_seconds.length;
  if (ok(payload?.normalized_alignment)) return payload.normalized_alignment;
  if (ok(payload?.alignment)) return payload.alignment;
  return null;
}

/**
 * Character-level alignment → word-level timings.
 *
 * ── THE UNIT CONVERSION. This is why this function exists. ──
 * ElevenLabs reports per-CHARACTER times in SECONDS. TalkingHead's speakAudio()
 * does integer-MILLISECOND arithmetic on what you hand it — `val.visemes.length
 * * 150`, `Math.min(60, 2*d/3)`, `Math.min(25, d/2)` — so wtimes/wdurations
 * must be ms, hence the ×1000 and the rounding below. Get it wrong and nothing
 * looks broken: the mouth still moves, it just drifts, which is exactly why
 * this is spelled out here and pinned by a test.
 *
 * Words are split on whitespace; a word starts at its FIRST character's start
 * and runs to its LAST character's end. Returns three arrays of equal length.
 */
export function wordsFromAlignment(alignment) {
  const words = [], wtimes = [], wdurations = [];
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) {
    return { words, wtimes, wdurations };
  }

  const n = Math.min(chars.length, starts.length, ends.length);
  let text = '', first = -1, last = -1;

  const flush = () => {
    if (text && first >= 0) {
      const t0 = Number(starts[first]);
      const t1 = Number(ends[last]);
      // Drop a word whose times are junk rather than emitting NaN: a NaN in
      // wtimes poisons the avatar's whole schedule.
      if (Number.isFinite(t0) && Number.isFinite(t1)) {
        words.push(text);
        wtimes.push(Math.round(t0 * 1000));                       // s → ms
        wdurations.push(Math.max(0, Math.round((t1 - t0) * 1000)));// s → ms
      }
    }
    text = ''; first = -1; last = -1;
  };

  for (let i = 0; i < n; i++) {
    const c = String(chars[i] ?? '');
    if (!/\S/.test(c)) { flush(); continue; }   // whitespace ends a word
    if (first < 0) first = i;
    last = i;
    text += c;
  }
  flush();

  return { words, wtimes, wdurations };
}

/** base64 → bytes, for the MP3 that /with-timestamps sends inline. */
function base64ToBytes(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

/** Rough read-aloud duration, used when nothing can tell us the real one. */
export function estimate(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round(words / 2.55 * 1000));   // ~153 wpm
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── speech-to-text for the Ask box ───────────────────────────────────── */

export function createRecogniser({ onResult, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'en-GB';
  r.interimResults = true;
  r.continuous = false;
  r.onresult = e => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      e.results[i].isFinal ? (final += t) : (interim += t);
    }
    onResult?.(final || interim, Boolean(final));
  };
  r.onend = () => onEnd?.();
  r.onerror = () => onEnd?.();
  return r;
}
