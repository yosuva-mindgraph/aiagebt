/* ============================================================================
   The avatar backends — seam S4.

   Two things implement the same tiny interface, and the Presenter picks one:

     Avatar3D       met4citizen/TalkingHead, a rigged GLB in WebGL. Drives its
                    own audio clock, so it does the PLAYING as well as the
                    mouthing — ownsPlayback: true.
     CanvasBackend  the drawn IRIS bust in src/avatar.js, wrapped. It only
                    animates; Voice still plays — ownsPlayback: false.

   The interface both satisfy:

     static async create(mountEl, opts) → backend | null
     kind          'canvas' | 'talkinghead'
     ownsPlayback  boolean — does speak() also make the sound?
     setState(s)   'idle' | 'speaking' | 'listening' | 'thinking'
     speak(text, durationMs, clip?) → Promise<void>
     stopSpeaking()
     setLevel(rms|null)
     destroy()

   ── create() RETURNS null, IT DOES NOT THROW ──────────────────────────────
   That is the whole fallback story. A booth machine with a blocklisted GPU, a
   phone where the rail is display:none, a viewer who asked for reduced motion —
   none of those are errors, they are just "no 3D today". Avatar3D.create()
   answers null for every one of them, logs the reason ONCE, and the Presenter
   uses the canvas bust for the rest of the session. The deck never notices.

   ── speak() RESOLVES ON END *OR* ON CANCEL. NEVER REJECTS, NEVER HANGS ────
   This is the constraint the whole file is shaped around, and the reason is in
   docs/TALKINGHEAD.md trap 4: TalkingHead's stopSpeaking() does

       this.speechQueue.length = 0;              // talkinghead.mjs L3446

   and a pending speakMarker() callback is IN that queue, so it is thrown away
   without ever being called (vendor/smoke.cjs pins this as markerAfterStop:
   false). So stopSpeaking() here resolves the outstanding promise itself, with
   a done-guard so it cannot resolve twice — the same pattern src/voice.js uses
   for a dropped Web Speech utterance. A timeout backs it up.

   It matters more here than it would elsewhere: the cold open says "Stop me
   with a question at any point", so interruption is the NORMAL case. A speak
   promise that hangs on cancel hangs the walkthrough.
   ========================================================================== */

import { Avatar } from './avatar.js';

/* Construction options that are load-bearing rather than taste. Everything here
   is verified in docs/TALKINGHEAD.md; change one and read that first.

   EVERY key below is greppable in vendor/talkinghead.bundle.js. That is not a
   formality: the README on `main` documents options this pinned npm 1.7.0 does
   not have, and TalkingHead reads its options with plain `hasOwnProperty`
   checks — an unknown key is not rejected, it is ignored in silence. Check the
   bundle, not the docs site. */
const AVATAR3D_DEFAULTS = {
  /* ── framing ───────────────────────────────────────────────────────────
     cameraView accepts ONLY 'full' | 'mid' | 'upper' | 'head'. setView() does a
     silent `return` on anything else (talkinghead.mjs L1419), so a typo here
     costs you an hour wondering why the camera ignored you.

     The camera is put at (0, u, h) looking level at (0, u, 0), so the frame is
     a band of the model in WORLD Y. With the camera's fov 10° — fixed, not an
     option — and avatarHeight H (which is NOT the model's height: it is
     `LeftEye.getWorldPosition().y + 0.2`, so 1.814 here), setView() computes

         h = cameraDistance + {head:2, upper:4.5, mid:8, full:12}
         base = {head: 4H/5, upper: 2H/3, mid: H/3, full: 0}
         bottom of frame = base − cameraY·tan(5°)·h
         top    of frame = base + (2 − cameraY)·tan(5°)·h

     Three things fall out of that and none of them is obvious:

     1. cameraDistance is not a dolly, it is a ZOOM about the bottom edge.
        Setting cameraY 0 pins `bottom` to `base` whatever the distance, so
        pulling in crops the ceiling and leaves the waistline exactly where it
        was. Reaching for it to "see more of her" is the natural move and it
        does nothing.
     2. cameraY is the vertical PAN, and it is INVERTED — it enters as
        `(1 − cameraY)`, so POSITIVE lowers the frame. It is the only control
        that moves the bottom edge.
     3. The VIEW NAME IS ONLY THAT `base` OFFSET. It is not a lens and not a
        crop — any frame reachable from one name is reachable from any other by
        compensating with cameraY, so arguing 'upper' vs 'mid' is arguing about
        nothing. What matters is the pair of numbers below. Pick the name whose
        trims come out small and honest, which for a waist-up shot is 'mid'.

     Because the panel is square and the fov is vertical, this framing is
     viewport-INDEPENDENT: 1440 and 1920 differ in pixels, not in crop.

     Measured against the shipped avatar (H = 1.814, crown of the hair at
     y ≈ 1.78, eyes 1.60, chin 1.53, shoulders 1.39, jacket BUTTON 1.06, jacket
     HEM 0.96, trousers below that), the frame below is [0.779, 1.838]:

         crown 1.78 sits 0.06 below the top edge — headroom that survives
         avatarSpeakingHeadMove without ever clipping the hair;
         the hem at 0.96 and the top of the trousers are comfortably in shot;
         the hands enter the bottom corners, where the idle/speaking gesture
         reads as a presenter's gesture instead of an elbow appearing from
         off-frame, which is what the old crop did.

     That bottom edge is the whole point, and it is the answer to a real
     complaint: at the OLD frame ([1.216, 1.899]) the bottom edge sat at
     mid-chest, ABOVE the jacket's button and hem. With no lapel notch, no
     opening and no hem in shot, this avatar's suit is a grey torso with a
     lighter panel down the middle — and it reads as a LEOTARD. It is not a
     material fault and no amount of relighting fixes it; the garment cues are
     simply outside the frame. Rendered, the ladder is:

         bottom ≤ 1.05  the button appears        — not enough on its own
         bottom ≤ 0.90  the hem line appears      — starts to read as a jacket
         bottom ≤ 0.80  hem + trousers together   — reads as a trouser suit

     The cost is head size: the chin-to-crown band goes 145 px → 74 px of the
     339 px panel. That is still ample for lip-sync — a full viseme_aa opens the
     mouth about 6 px here, which is plainly visible motion — and the evidence
     grid is in docs/TALKINGHEAD.md. Do not "fix" the head size by cropping back
     up; the leotard comes back with it. */
  cameraView: 'mid',
  cameraDistance: -1.95,
  cameraY: -0.33,
  modelFPS: 30,
  /* The viewer is not meant to spin the presenter like a turntable. */
  cameraRotateEnable: false,

  /* ── lighting ──────────────────────────────────────────────────────────
     Stock TalkingHead is lit for its own demo page, and on a presenter panel it
     is wrong in a way that reads as "cheap 3D": lightDirectIntensity 30, cold
     blue-grey 0x8888AA, at phi 1 / theta 2. setLighting() turns that pair of
     angles into a position with setFromSphericalCoords(2, phi, theta) — i.e.

         (2·sin φ·sin θ, 2·cos φ, 2·sin φ·cos θ) = (1.53, 1.08, −0.70)

     — above, camera-RIGHT and BEHIND the head, aimed at the light's default
     target, the origin, which is the avatar's FEET. A rake light at intensity
     30. That single number is most of the "blown out and flat" complaint and it
     is why pale faces clipped to white.

     The angle itself is fine — it is a decent three-quarter rim. Only the
     intensity was wrong. So keep phi/theta and spend the budget on colour:
     DXC Sky as a cool rim, DXC Peach as the warm ambient fill. Warm key / cool
     rim is the broadcast cue that makes a render read as a lit person rather
     than a model viewer, and it costs nothing at runtime. */
  lightDirectColor: 0xA1E6FF,      // DXC Sky   — the cool rim
  lightDirectIntensity: 3,         // was 30
  lightDirectPhi: 1.0,
  lightDirectTheta: 2.0,
  lightAmbientColor: 0xFFC982,     // DXC Peach — the warm fill
  lightAmbientIntensity: 2.0,
  /* Off. It is a SpotLight aimed, like the directional, at the origin — the
     feet — and all it contributes up here is a hard edge across the jaw.
     setLighting() also flips `visible` to false on a zero intensity, so this
     costs nothing per frame rather than shading black. */
  lightSpotIntensity: 0,

  /* ── idle and speaking behaviour ───────────────────────────────────────
     Stock is avatarIdleEyeContact 0.2 / avatarIdleHeadMove 0.5 — a figure that
     mostly looks away and sways while it does. On a demo page that reads as
     life; in a 339 px panel beside a deck it reads as a presenter who is not
     listening to you, and the sway is large relative to the head. So: full eye
     contact in both states, no idle head movement at all, and just enough
     while speaking to avoid a waxwork.

     These are ALSO what replaces lookAtCamera() (see setState below) — holding
     the viewer with the EYES is what that call was reaching for, and the eyes
     can do it without pitching the whole head back. */
  avatarIdleEyeContact: 1,
  avatarIdleHeadMove: 0,
  avatarSpeakingEyeContact: 1,
  avatarSpeakingHeadMove: 0.15,
};

/** Is there a GPU we can actually get a context from? */
function probeWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    // Hand the probe context straight back. Browsers cap live WebGL contexts
    // (~16 in Chrome) and silently kill the OLDEST one when you go over, which
    // would be the avatar's — so never leave a spare lying around.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Can this element hold a renderer?
 *
 * TalkingHead measures the mount with clientWidth/clientHeight and hands those
 * to WebGLRenderer.setSize(). src/styles.css hides #rail entirely at the mobile
 * breakpoint, so on a phone the mount is 0×0 — and a zero-size renderer is not
 * an error, it is an invisible, fully-paid-for WebGL context. Don't burn one.
 */
function canMount(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  try {
    if (getComputedStyle(el).display === 'none') return false;
  } catch {}
  return true;
}

/**
 * Word timings when ElevenLabs did not give us any.
 *
 * Voice's Clip carries words/wtimes/wdurations, but they may all be EMPTY when
 * the alignment came back unusable — the audio still plays. speakAudio() with
 * no words produces no visemes at all, i.e. a face that talks with its mouth
 * shut, which reads as broken. So spread the text over the measured duration
 * instead: longer words get proportionally more of it. Approximate, but the eye
 * reads "mouth moving in time with speech" long before it reads phonemes.
 *
 * Also the whole story for the no-clip case (Web Speech / muted), where there
 * are no real timings to be had at all.
 */
function wordTimingsFromText(text, durationMs) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const wtimes = [], wdurations = [];
  if (!words.length) return { words, wtimes, wdurations };

  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const span = Math.max(400, durationMs || 0);
  let at = 0;
  for (const w of words) {
    const share = ((w.length + 1) / total) * span;
    wtimes.push(Math.round(at));
    // Integer MILLISECONDS — speakAudio() does ms arithmetic on these
    // (`val.visemes.length * 150`, `Math.min(60, 2*d/3)`). Seconds here would
    // not look broken, just permanently drifted. See wordsFromAlignment().
    wdurations.push(Math.max(60, Math.round(share)));
    at += share;
  }
  return { words, wtimes, wdurations };
}

/** base64 → Blob object URL, for a GLB that cannot be fetched. */
function glbObjectUrl(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
}

/* ── the 3D backend ───────────────────────────────────────────────────── */

export class Avatar3D {
  /**
   * Build the 3D presenter, or answer null if this machine cannot have one.
   *
   * @param {HTMLElement} mountEl  a sized, visible box; the renderer canvas is
   *                               appended INTO it by TalkingHead.
   * @param {Object} opts          { onWord, glbUrl, mood }
   * @returns {Promise<Avatar3D|null>}
   */
  static async create(mountEl, opts = {}) {
    const bail = why => {
      // Once per session, not once per attempt: falling back is a fact to state
      // plainly, not a fault to nag about.
      if (!Avatar3D._warned) {
        Avatar3D._warned = true;
        console.warn(`[avatar3d] 3D presenter unavailable (${why}) — using the canvas avatar.`);
      }
      return null;
    };

    if (typeof window === 'undefined' || typeof window.TalkingHead !== 'function') {
      return bail('window.TalkingHead is not defined');
    }
    // Without LipsyncEn, lipsyncPreProcessText() dereferences undefined inside
    // speakAudio() (talkinghead.mjs L2768) — i.e. it would construct fine and
    // then throw on the first line of narration. Fail here instead, where the
    // failure is still a fallback rather than a stall.
    if (typeof window.LipsyncEn !== 'function') {
      return bail('window.LipsyncEn is not defined');
    }
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return bail('prefers-reduced-motion: reduce');
      }
    } catch {}
    if (!canMount(mountEl)) return bail('the mount element has no size or is display:none');
    if (!probeWebGL()) return bail('no WebGL context available');

    /* modelPixelRatio is a MULTIPLIER, not an absolute: talkinghead.mjs L832
       does `setPixelRatio(opt.modelPixelRatio * window.devicePixelRatio)`. So
       passing devicePixelRatio here would square it — 4× the pixels on a 2×
       display, on a software renderer, for no visible gain. Pass the ratio that
       makes the PRODUCT the cap we actually want. */
    const dpr = window.devicePixelRatio || 1;

    const thOpts = {
      ...AVATAR3D_DEFAULTS,
      ...(opts.talkingHead || {}),
      // ttsEndpoint stays empty: TalkingHead's own Google-TTS path is never
      // used. ElevenLabs (or Web Speech) is the voice; see seam S3.
      ttsEndpoint: '',
      lipsyncLang: 'en',
      // Empty, then hand the processor over below — TalkingHead's lazy loader
      // is a computed dynamic import() that no bundler can resolve and that
      // would want the network anyway. docs/TALKINGHEAD.md trap 2.
      lipsyncModules: [],
      // MUST stay false: draco makes it fetch a decoder from gstatic.com,
      // which is an air-gap violation on a booth machine. Trap 3.
      dracoEnabled: false,
      modelPixelRatio: Math.min(dpr, 2) / dpr,
    };

    let th = null;
    let blobUrl = null;
    try {
      th = new window.TalkingHead(mountEl, thOpts);
      th.lipsync['en'] = new window.LipsyncEn();      // before ANY speak call
    } catch (err) {
      try { th?.dispose?.(); } catch {}
      return bail(`TalkingHead constructor threw: ${err?.message || err}`);
    }

    try {
      /* The GLB arrives as bytes in the page, not as a URL to fetch.
         dist/index.html is one self-contained file that gets double-clicked, and
         Chrome CORS-blocks fetch() of a file:// URL even for a sibling — so the
         shipped path is base64 → Blob → object URL. The relative-URL branch is
         only for `npx serve .` during development. Trap 3. */
      const b64 = window.AIB_AVATAR_GLB_B64;
      const url = (typeof b64 === 'string' && b64.length > 64)
        ? (blobUrl = glbObjectUrl(b64))
        : (opts.glbUrl || 'assets/avatar.glb');

      await th.showAvatar({
        url,
        body: 'F',
        avatarMood: opts.mood || 'neutral',
        lipsyncLang: 'en',
      });
    } catch (err) {
      if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} }
      try { th.dispose?.(); } catch {}
      return bail(`the avatar GLB did not load: ${err?.message || err}`);
    }

    const backend = new Avatar3D(th, mountEl, opts);
    /* Release the blob the moment the loader is done with it — the GLB is ~4.7
       MB and the base64 it came from is still in the page, so holding both for
       the session doubles the bill for nothing. destroy() revokes it again;
       revoking twice is a no-op, and that belt is what makes the "always
       release the object URL" promise true on every path. */
    backend.blobUrl = blobUrl;
    if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} }

    // Re-apply the view now the armature exists. showAvatar() already did this
    // once from opt.cameraView, but only if no view had been set — doing it
    // here is what makes a caller's camera trim land in both orders.
    try { th.setView(thOpts.cameraView, thOpts); } catch {}
    return backend;
  }

  constructor(th, mountEl, opts = {}) {
    this.kind = 'talkinghead';
    /* TalkingHead schedules visemes against its OWN audio clock, so it has to
       be the thing that starts the buffer. Voice hands over a decoded Clip and
       keeps out of the way. */
    this.ownsPlayback = true;
    this.th = th;
    this.mountEl = mountEl;
    this.onWord = typeof opts.onWord === 'function' ? opts.onWord : null;
    this.state = 'idle';
    this.blobUrl = null;
    this._mood = opts.mood || 'neutral';
    this._finish = null;      // resolver for the speak() in flight, if any
    this._timers = [];
  }

  /**
   * Seam S3 — the AudioContext the Presenter must hand to Voice.
   *
   * TalkingHead 1.7.0 builds its own in initAudioGraph() and offers no
   * injection point (`grep -c "audioCtx:"` → 0). A Clip decoded in one context
   * and played in another is resampled across the boundary, so Voice adopts
   * this one via voice.useAudioContext(). It starts SUSPENDED; the #startBtn
   * click is what unlocks it.
   */
  get audioContext() { return this.th?.audioCtx || null; }

  setState(s) {
    this.state = s;
    // Moods are expensive-ish (they re-baseline every morph target), so only
    // touch it when it actually changes. setMood() THROWS on an unknown name.
    const mood = s === 'listening' ? 'happy' : 'neutral';
    if (mood !== this._mood) {
      try { this.th.setMood(mood); this._mood = mood; } catch {}
    }
    /* ── DO NOT ADD lookAtCamera() BACK. IT IS THE CHIN-UP. ────────────────
       `th.lookAtCamera(1200)` used to sit right here, on 'listening' and
       'speaking'. It is why she lifted her chin the instant anyone spoke to
       her — level while silent, staring at the ceiling the moment it mattered.

       The mechanism, from the bundle. We never set `speakTo`, so
       lookAtCamera() falls through to `lookAt(null, null, dur)`, and lookAt's
       null defaults are the SCREEN POSITION OF THE AVATAR'S OWN EYES — it
       projects them and aims at that. The vertical target is then

           convertRange(eyeScreenY, [c−y, c+y], [−0.3, 0.6]) − u + d

       with the same eyeScreenY as `c`, i.e. always the midpoint of that
       range — so it resolves to a CONSTANT +0.15 pitch bias, minus the head
       chain's current pitch `u`. It is not aiming at the camera in any
       meaningful sense; at our framing it is a fixed backward tilt applied on
       top of whatever pose she is in. Removing the call is the whole fix, and
       it was A/B'd on fresh page loads under an identical audio line.

       Two things NOT to do about it, both tried and rendered:

       · `avatarIgnoreCamera: true`, which looks like the official escape hatch
         (lookAtCamera checks it and diverts to lookAhead()). It is worse.
         lookAhead() queues `eyeContact: [0]` plus a random bodyRotateX/Y of
         ±0.125 — so instead of a chin-up you get a presenter glancing off to
         one side, mid-sentence. Leave it at its default false.
       · Cancelling it with a manual Head.rotation.x. It over-corrects, and the
         value it must cancel depends on the current pose, so it is wrong in
         every state but the one it was tuned in.

       And one thing to KNOW: this is not the only caller. startSpeaking() does
           else if (t.audio) t.isRaw || (this.lookAtCamera(500), …)
       so the library re-issues it on every line that carries audio — which is
       the shipped ElevenLabs path. That call cannot be removed from out here
       and does not need to be: fired from the speaking pose its `u` term very
       nearly cancels the +0.15, and it renders level. Measured, not assumed.
       Do not go monkey-patching it.

       What actually holds the viewer is avatarIdleEyeContact /
       avatarSpeakingEyeContact at 1, above — the EYES, which is what the call
       was reaching for, without pitching the whole head to get it. */
  }

  /**
   * Speak one line. Resolves when the line ends OR when it is cancelled.
   *
   * With a Clip we own playback: speakAudio() takes the decoded buffer plus the
   * word timings and does both the sound and the mouth. Without one (Web Speech
   * is doing the talking, or we are muted) the same call with no `audio` key
   * queues visemes ONLY — TalkingHead's "only subtitles" branch — so the mouth
   * still moves in time with somebody else's voice.
   */
  speak(text, durationMs, clip = null) {
    // A speak() landing on top of another must not strand the first promise.
    this._settle();

    const audio = clip?.audioBuffer || null;
    let words = clip?.words, wtimes = clip?.wtimes, wdurations = clip?.wdurations;
    if (!words || !words.length) {
      ({ words, wtimes, wdurations } = wordTimingsFromText(text, durationMs));
    }

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this._timers.forEach(clearTimeout);
        this._timers = [];
        if (this._finish === finish) this._finish = null;
        resolve();
      };
      this._finish = finish;                     // stopSpeaking() calls this

      /* Belt and braces, exactly as src/voice.js guards a dropped utterance.
         Chrome silently losing a SpeechSynthesisUtterance and TalkingHead
         silently losing a speakMarker are the same class of stall, and one
         unresolved line stops the whole walkthrough. +300ms because speakAudio()
         pushes a `{break: 300}` of its own behind every clip (L3154). */
      this._timers.push(setTimeout(finish, Math.max(600, durationMs || 0) + 4300));

      try {
        const payload = audio
          ? { audio, words, wtimes, wdurations }
          : { words, wtimes, wdurations };

        this.th.speakAudio(
          payload,
          { lipsyncLang: 'en' },
          // onsubtitles receives a STRING (' ' + word), not a DOM node — the
          // JSDoc in talkinghead.mjs is wrong about this. Word-timed, so it is
          // what a caption highlighter wants.
          this.onWord ? (s => { try { this.onWord(String(s).trim()); } catch {} }) : null,
        );

        if (audio) {
          // Fires when the queue drains past this point — i.e. at the real end
          // of the audio. Dropped on stopSpeaking(); that is what _finish is for.
          this.th.speakMarker(finish);
        } else {
          // Viseme-only: the queue drains in ~10ms per anim, so a marker would
          // fire almost immediately and mean nothing. Time it out instead.
          this._timers.push(setTimeout(finish, Math.max(400, durationMs || 0)));
        }
      } catch (err) {
        console.warn('[avatar3d] speakAudio failed:', err?.message || err);
        finish();
      }
    });
  }

  /**
   * Stop mid-line. THE trap: th.stopSpeaking() empties speechQueue, taking the
   * pending marker with it uncalled, so we must resolve the promise ourselves.
   */
  stopSpeaking() {
    try { this.th.stopSpeaking(); } catch {}
    this._settle();
    if (this.state === 'speaking') this.state = 'idle';
  }

  /** Resolve whatever speak() is outstanding, once. */
  _settle() {
    const f = this._finish;
    this._finish = null;
    if (f) f();
  }

  /**
   * Mute without silencing Voice.
   *
   * Seam S3 again: once TalkingHead owns playback, the audio is inside ITS
   * graph — voice.stop() has no handle on th.audioSpeechSource and cannot
   * silence it. The gain node can. Muting must not stop us FETCHING clips
   * either: the clip is what carries the word timings, so the face keeps
   * mouthing in step while the room hears nothing.
   */
  setMuted(muted) {
    try { this.th.setMixerGain(muted ? 0 : 1, null, 0.12); } catch {}
  }

  /**
   * No-op, deliberately. The canvas bust needs Voice to feed it RMS; this one
   * has the audio in its own analyser node and drives jaw and head from it.
   * Kept so the two backends are interchangeable.
   */
  setLevel() {}

  destroy() {
    this.stopSpeaking();
    // dispose() stops the render loop, releases the WebGL context, and
    // disconnects the audio nodes. It does NOT close audioCtx — which is what
    // we want, because Voice adopted that context (seam S3) and may still be
    // playing through it. It does call stop(), which SUSPENDS it. Measured
    // after dispose(): state 'suspended', never 'closed', and voice.play()
    // resumes it and works — so tearing down the 3D backend does not take the
    // sound with it. Closing it here would.
    try { this.th?.dispose?.(); } catch {}
    if (this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch {} this.blobUrl = null; }
    this._timers.forEach(clearTimeout);
    this._timers = [];
    this.th = null;
  }
}

/* ── the canvas backend (the fallback, and the default) ───────────────── */

/**
 * src/avatar.js wrapped to seam S4.
 *
 * That file is frozen: it is the fallback, it works, and every 3D failure path
 * lands here. So the adaptation lives out here rather than in it.
 */
export class CanvasBackend {
  static async create(mountEl, opts = {}) {
    try {
      const canvas = mountEl && mountEl.tagName === 'CANVAS'
        ? mountEl
        : mountEl?.querySelector?.('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      if (!canvas.getContext('2d')) return null;
      return new CanvasBackend(new Avatar(canvas, { name: opts.name || 'IRIS' }), canvas);
    } catch (err) {
      console.warn('[avatar3d] canvas avatar unavailable:', err?.message || err);
      return null;
    }
  }

  constructor(avatar, canvas) {
    this.kind = 'canvas';
    // Voice plays; this only draws. The Presenter therefore awaits Voice and
    // fires speak() alongside it rather than awaiting it.
    this.ownsPlayback = false;
    this.avatar = avatar;
    this.canvas = canvas;
    this.state = 'idle';
    this._finish = null;
    this._timer = 0;
  }

  get audioContext() { return null; }

  setState(s) { this.state = s; try { this.avatar.setState(s); } catch {} }

  /**
   * Run the lip-sync animation for durationMs.
   *
   * Resolves on the same terms as the 3D one — at the end, or on cancel — so
   * the Presenter can treat the two identically even though nothing here is
   * waiting on audio.
   */
  speak(text, durationMs) {
    this._settle();
    try { this.avatar.speak(text, durationMs); } catch {}
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(this._timer);
        if (this._finish === finish) this._finish = null;
        resolve();
      };
      this._finish = finish;
      this._timer = setTimeout(finish, Math.max(300, durationMs || 0));
    });
  }

  stopSpeaking() {
    try { this.avatar.stopSpeaking(); } catch {}
    this._settle();
    if (this.state === 'speaking') this.state = 'idle';
  }

  _settle() { const f = this._finish; this._finish = null; if (f) f(); }

  /** Real RMS from Voice → the jaw. This is why Voice decodes rather than
      using an <audio> element. */
  setLevel(v) { try { this.avatar.setLevel(v); } catch {} }

  /** Muting is Voice's job on this backend — there is no audio graph here. */
  setMuted() {}

  destroy() {
    this.stopSpeaking();
    try { this.avatar.destroy(); } catch {}
    this.avatar = null;
  }
}
