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

export class Voice {
  constructor(config = {}) {
    this.cfg = config;
    this.muted = false;
    this.current = null;        // { cancel() }
    this.audioCtx = null;
    this.onLevel = null;        // (rms 0..1) => void
    this.voice = null;
    this._pickVoice();
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get usingElevenLabs() {
    return Boolean(this.cfg?.elevenLabs?.apiKey);
  }

  setMuted(m) { this.muted = m; if (m) this.stop(); }

  stop() {
    if (this.current) { try { this.current.cancel(); } catch {} this.current = null; }
    if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
    this.onLevel?.(null);
  }

  /** Speak one line. Resolves when it finishes (or immediately when muted). */
  async say(text) {
    this.stop();
    if (this.muted || !text) { await sleep(estimate(text) * 0.35); return; }
    if (this.usingElevenLabs) {
      try { return await this._elevenLabs(text); }
      catch (err) { console.warn('[voice] ElevenLabs failed, falling back to Web Speech:', err?.message || err); }
    }
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

  async _elevenLabs(text) {
    const {
      apiKey, voiceId: configuredVoice, modelId = 'eleven_turbo_v2_5',
      stability = 0.45, similarity = 0.80, style = 0.35,
    } = this.cfg.elevenLabs;
    const voiceId = configuredVoice || DEFAULT_VOICE;

    const controller = new AbortController();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true },
        }),
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);

    const buf = await res.arrayBuffer();
    this.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    const decoded = await this.audioCtx.decodeAudioData(buf);

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
      src.onended = finish;
      this.current = { cancel: () => { controller.abort(); try { src.stop(); } catch {} finish(); } };
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
