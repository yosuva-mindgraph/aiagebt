/* ============================================================================
   The Presenter — "speak one line", and the only thing the controller awaits.

   One method matters:

       await presenter.say(text)

   Everything the two avatar backends disagree about lives behind it. The 3D
   backend drives visemes off its own audio clock, so it must do the playing;
   the canvas one only draws, so Voice plays. The controller should not have to
   know which is up, and after this file it does not:

       const clip = await voice.synthesize(text);      // null = no key/failed
       if (backend.ownsPlayback && clip)               // TalkingHead: it plays
         await backend.speak(text, clip.durationMs, clip);
       else {                                          // canvas: Voice plays
         backend.speak(text, estimate(text));          // visual, alongside
         await (clip ? voice.play(clip) : voice.speakBrowser(text));
       }

   ── say() ALWAYS SETTLES ──────────────────────────────────────────────────
   It resolves on the natural end of the line, or within a frame or two of
   cancel(). It never rejects and it never hangs. That is not defensive
   decoration — the cold open literally says "Stop me with a question at any
   point", so being interrupted is the NORMAL case, and there are four
   independent ways a line can otherwise go quiet forever:

     · TalkingHead's stopSpeaking() empties speechQueue and drops the pending
       speakMarker uncalled (docs/TALKINGHEAD.md trap 4, pinned as
       markerAfterStop: false in vendor/smoke.cjs);
     · Chrome silently drops a long SpeechSynthesisUtterance and never fires
       onend (src/voice.js guards this one);
     · an AudioContext suspended mid-clip never fires onended (guarded too);
     · an ElevenLabs fetch that neither resolves nor rejects.

   Each layer guards its own case, and say() races the lot against an explicit
   cancel signal so a stall in any of them cannot outlive a click.

   ── seam S3, the AudioContext ─────────────────────────────────────────────
   TalkingHead 1.7.0 builds its own AudioContext in initAudioGraph() and gives
   you nowhere to inject one. When the 3D backend comes up, this file hands that
   context to Voice (voice.useAudioContext) so a Clip is decoded and played in
   ONE context at ONE sample rate. With the canvas backend Voice keeps its own.
   The context starts suspended; the #startBtn click is what unlocks it.
   ========================================================================== */

import { Avatar3D, CanvasBackend } from './avatar3d.js';
import { estimate } from './voice.js';

/** A promise plus the function that resolves it. The cancel channel. */
function makeDeferred() {
  let fire = () => {};
  const promise = new Promise(resolve => { fire = resolve; });
  return { promise, fire };
}

const pause = ms => new Promise(r => setTimeout(r, ms));

export class Presenter {
  /**
   * Build the presenter, preferring 3D and falling back silently.
   *
   * @param {Object} o
   * @param {Voice}  o.voice    the Voice instance (required)
   * @param {HTMLCanvasElement} [o.canvas]  the existing 2D avatar canvas
   * @param {HTMLElement} [o.mount]  box for the 3D renderer; one is made inside
   *                                 the canvas's parent if you don't pass it
   * @param {function} [o.onWord]    word-timed hook, 3D only (caption highlight)
   * @param {function} [o.onState]   told about every state change
   * @param {boolean} [o.prefer3D=true]
   */
  static async create(o = {}) {
    const { voice, canvas = null, name = 'IRIS', prefer3D = true } = o;

    /* If nobody handed us a mount, make one over the canvas. It has to be a
       real, sized box BEFORE TalkingHead measures it, hence absolute+inset
       inside #stageCanvasWrap (which is position:relative, aspect-ratio 1/1).
       Inline styles rather than a class because src/styles.css is another
       task's file — and because this element only exists when 3D wins. */
    let mount = o.mount || null;
    let ownsMount = false;
    if (!mount && canvas?.parentElement) {
      mount = document.createElement('div');
      mount.className = 'avatar3d-mount';
      mount.setAttribute('aria-hidden', 'true');
      mount.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
      canvas.parentElement.insertBefore(mount, canvas);
      ownsMount = true;
    }

    let backend = null;
    if (prefer3D && mount) {
      backend = await Avatar3D.create(mount, {
        onWord: o.onWord,
        glbUrl: o.glbUrl,
        talkingHead: o.talkingHead,
      });
    }

    if (backend) {
      // Two presenters on screen at once is worse than either alone.
      if (canvas) canvas.style.display = 'none';
    } else {
      if (ownsMount) { mount.remove(); ownsMount = false; }
      mount = null;
      backend = await CanvasBackend.create(canvas, { name });
    }

    if (!backend) {
      /* No 3D, no 2D — a page with no avatar element at all (shoot.js frames,
         a test harness). Narration must still run, so stand in an inert backend
         rather than making every call site null-check. */
      console.warn('[presenter] no avatar surface — narrating with no visual.');
      backend = {
        kind: 'none', ownsPlayback: false, audioContext: null,
        setState() {}, stopSpeaking() {}, setLevel() {}, setMuted() {}, destroy() {},
        speak: (t, d) => pause(Math.max(300, d || 0)),
      };
    }

    return new Presenter(backend, voice, { mount, ownsMount, canvas, onState: o.onState });
  }

  constructor(backend, voice, o = {}) {
    this.backend = backend;
    this.voice = voice;
    this.mount = o.mount || null;
    this.ownsMount = Boolean(o.ownsMount);
    this.canvas = o.canvas || null;
    this.onState = typeof o.onState === 'function' ? o.onState : null;
    this.state = 'idle';
    this.muted = false;

    this._epoch = 0;          // bumped by cancel(); invalidates a line in flight
    this._cancel = null;      // the deferred the current say() is racing

    /* Seam S3. Voice decodes into whatever context it is given; handing it
       TalkingHead's means one context, one sample rate, no resampling across
       the boundary — and no orphaned second AudioContext (browsers cap you at
       about six, so leaking one per handover eventually throws). */
    if (backend.audioContext && typeof voice?.useAudioContext === 'function') {
      voice.useAudioContext(backend.audioContext);
    }

    /* Real RMS → the jaw, on the canvas backend. The 3D one has the audio in
       its own analyser and ignores this. Presenter takes ownership of the hook
       so the controller has one place to look. */
    if (voice) voice.onLevel = v => { try { this.backend.setLevel(v); } catch {} };
  }

  get backendKind() { return this.backend.kind; }

  /** Is the 3D presenter the one on screen? */
  get is3D() { return this.backend.kind === 'talkinghead'; }

  setState(s) {
    this.state = s;
    try { this.backend.setState(s); } catch {}
    if (this.onState) { try { this.onState(s); } catch {} }
  }

  /**
   * Silence.
   *
   * Voice is muted either way — that stops the fetches, the playback and Web
   * Speech. The 3D backend additionally takes its gain to zero, because once
   * TalkingHead owns playback the buffer lives in ITS audio graph and
   * voice.stop() has no handle on it.
   */
  setMuted(m) {
    this.muted = Boolean(m);
    try { this.voice?.setMuted(this.muted); } catch {}
    try { this.backend.setMuted?.(this.muted); } catch {}
    try { this.backend.setLevel(null); } catch {}
    if (this.muted) this.cancel();
  }

  /**
   * Stop the current line NOW. The in-flight say() resolves; it does not throw.
   *
   * Order matters: stop the sound, stop the face, then fire the cancel channel
   * so say() returns having already left the stage quiet.
   */
  cancel() {
    this._epoch++;
    const fire = this._cancel;
    this._cancel = null;
    try { this.voice?.stop(); } catch {}
    try { this.backend.stopSpeaking(); } catch {}
    if (this.state === 'speaking') this.setState('idle');
    if (fire) fire();
  }

  /**
   * Speak one line. The single call the controller awaits.
   *
   * Resolves at the end of the line, or on cancel(), whichever comes first.
   */
  async say(text) {
    this.cancel();                       // one line at a time, always
    const line = String(text ?? '');
    if (!line.trim()) return;

    const my = ++this._epoch;
    const cancelled = makeDeferred();
    this._cancel = cancelled.fire;

    /* The outer watchdog. Every layer below guards its own stall, so this
       should never fire — it exists because "should never" is how a deck ends
       up frozen in front of a client. Deliberately generous: it is a backstop,
       not a timeout anyone should be tuning against. */
    let watchdog = 0;
    const backstop = new Promise(resolve => {
      watchdog = setTimeout(() => {
        console.warn('[presenter] a line outlived every guard — moving on.');
        resolve();
      }, estimate(line) + 20000);
    });

    try {
      await Promise.race([
        cancelled.promise,
        backstop,
        this._speak(line, my).catch(err => {
          // say() never rejects: a broken line must not take the walkthrough
          // down with it.
          console.warn('[presenter] line failed:', err?.message || err);
        }),
      ]);
    } finally {
      clearTimeout(watchdog);
      if (my === this._epoch) this._cancel = null;
    }
  }

  /** The real body of say(). Bails at every await if a cancel landed. */
  async _speak(text, my) {
    const alive = () => my === this._epoch;

    /* Muted: run the mouth, make no sound, and take a short beat rather than
       the full duration — the same shortcut voice.say() has always taken, so
       a muted run still reads as a walkthrough rather than as a slideshow
       waiting on silence. Never falls through to speakBrowser(), which does
       NOT check the mute flag. */
    if (this.muted) {
      this.setState('speaking');
      this._fire(this.backend.speak(text, estimate(text)));
      await pause(Math.round(estimate(text) * 0.35));
      if (!alive()) return;
      this.backend.stopSpeaking();
      this.setState('idle');
      return;
    }

    /* synthesize() resolves null — never throws — when keyless, muted or
       failed. It has no timeout of its own, though: cancel() aborts the fetch,
       but a request that simply never answers would sit here forever, so cap
       it and fall through to Web Speech. */
    const clip = await Promise.race([
      this.voice.synthesize(text),
      pause(Math.max(9000, estimate(text))).then(() => null),
    ]);
    if (!alive()) return;

    const durationMs = clip?.durationMs || estimate(text);
    this.setState('speaking');

    if (this.backend.ownsPlayback && clip) {
      // TalkingHead: one call does the sound AND the mouth, off one clock.
      await this.backend.speak(text, durationMs, clip);
    } else {
      // Canvas: the visual runs ALONGSIDE the audio, so it is fired, not
      // awaited — what we wait on is the thing making the noise.
      this._fire(this.backend.speak(text, durationMs));
      if (clip) await this.voice.play(clip);
      else await this.voice.speakBrowser(text);
    }

    if (!alive()) return;
    this.backend.stopSpeaking();
    this.setState('idle');
  }

  /** Start a backend promise we are not waiting on, without leaving a rejection
      unhandled if a backend ever starts throwing. */
  _fire(p) { if (p && typeof p.catch === 'function') p.catch(() => {}); }

  destroy() {
    this.cancel();
    try { this.backend.destroy(); } catch {}
    if (this.canvas) this.canvas.style.display = '';
    if (this.ownsMount && this.mount) { try { this.mount.remove(); } catch {} }
    this.mount = null;
  }
}
