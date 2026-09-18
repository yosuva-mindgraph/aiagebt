/* ============================================================================
   The controller.

   Owns the transport (play / pause / back / skip / jump), mounts a scene's
   stage, runs its narration line by line through the voice, keeps the caption
   and the film strip in step, and handles a question at any moment — which
   pauses the walkthrough, answers, and offers to resume.

   It does NOT know which avatar is on screen. There are two — a rigged GLB in
   WebGL and the drawn aperture — and they disagree about who plays the
   audio, so the Presenter owns that argument (src/presenter.js, seam S4) and
   this file speaks one line at a time through it:

       await this.presenter.say(text)

   That call always settles: at the end of the line, or within a frame or two of
   presenter.cancel(). Which is why the token/epoch dance below still works
   unchanged — every await is followed by `if (my !== this.token) return`, and
   an interrupted line comes back in about a millisecond rather than hanging on
   to the walkthrough it was told to let go of.
   ========================================================================== */

import { SCENES, sceneIndex, PRODUCT } from './scenes.js';
import { Voice, createRecogniser, estimate } from './voice.js';
import { Presenter } from './presenter.js';
import { Ask, spokenForm } from './ask.js';
import { dxcIcon, dxcHydrate } from './icons.js';

const $ = sel => document.querySelector(sel);

const CONFIG = window.AIB_CONFIG || {};

class App {
  constructor() {
    this.i = 0;
    this.line = 0;
    this.playing = false;
    this.seen = new Set();
    this.token = 0;                 // invalidates in-flight narration
    this.leaveHooks = [];
    this.lineHooks = new Map();
    this.muted = false;
    this.words = [];                // caption word spans, for _word()
    this.wordAt = 0;

    this.voice = new Voice(CONFIG);
    this.ask = new Ask(CONFIG);
    this.presenter = null;          // attached out of band — see _attach()

    this.el = {
      stage: $('#stage'), title: $('#sceneTitle'), caption: $('#captionText'),
      list: $('#sceneList'), counter: $('#sceneCounter'), progress: $('#progressFill'),
      play: $('#playBtn'), back: $('#backBtn'), skip: $('#skipBtn'),
      prev: $('#prevBtn'), next: $('#nextBtn'),
      mute: $('#muteBtn'), theme: $('#themeBtn'),
      answer: $('#answer'), ansBody: $('#ansBody'), ansQ: $('#ansQ'), ansClose: $('#ansClose'),
      askForm: $('#askForm'), askInput: $('#askInput'), mic: $('#micBtn'),
      state: $('#avatarState'), overlay: $('#overlay'),
    };

    this._buildStrip();
    this._wire();
    this.ready = this._attach();    // kicked off, deliberately NOT awaited
    this._setState('idle');
    this.el.caption.classList.add('idle');
    this.el.caption.textContent = 'Press start and I’ll take you through it. Stop me with a question whenever you like.';
    this.render(0, { play: false });
  }

  /* ── the presenter ────────────────────────────────────────────────────

     Presenter.create() is async — it probes WebGL, builds a renderer and pulls
     in a rigged GLB of several megabytes — and this constructor is not. Nothing
     the viewer can see depends on the result, so scene 0 paints immediately and
     the presenter attaches behind it. The only thing that ever waits on
     `this.ready` is a line about to be spoken (play(), handleAsk()).

     create() does not throw and does not signal failure: a backendKind of
     'canvas' is the NORMAL fallback, not an error state, and it is the path
     that ships today. */
  async _attach() {
    const canvas = $('#avatar');
    const mount = $('#avatar3d');

    /* The mount ships `hidden`, which is display:none, and Avatar3D.create()
       declines a mount that is display:none or measures under 8px — so the
       attribute has to come off BEFORE it looks, and go back on if the canvas
       backend won. Un-hiding is not the same as forcing a size: #rail is
       display:none under 760px, so on a phone this still measures 0x0 and
       create() still declines, which is the point — an invisible WebGL context
       costs exactly as much as a visible one. */
    if (mount) {
      mount.hidden = false;
      mount.setAttribute('aria-hidden', 'true');   // decorative, like #avatar
    }

    let presenter = null;
    try {
      presenter = await Presenter.create({
        voice: this.voice,
        canvas,
        mount,
        onWord: () => this._word(),
      });
    } catch (err) {
      console.warn('[app] the presenter did not come up:', err?.message || err);
    }

    /* create() is documented never to throw — it stands in an inert backend
       rather than returning nothing. This is for the day that stops being true:
       losing the presenter has to cost the room the VOICE, not the walkthrough,
       so the stand-in still takes a line's worth of time and then returns.
       Resolving instantly here would sprint through all twelve scenes. */
    this.presenter = presenter || {
      backendKind: 'none',
      say: t => wait(estimate(t)),
      cancel() {}, setState() {}, setMuted() {},
    };

    // Exactly one backend on screen: 3D won and Presenter already hid the
    // canvas, or it did not and the empty mount goes back out of the way.
    if (mount && this.presenter.backendKind !== 'talkinghead') mount.hidden = true;

    // Catch up on anything the shell decided while we were still loading.
    if (this.muted) this.presenter.setMuted(true);
    this.presenter.setState(this.el.state.dataset.state || 'idle');
    return this.presenter;
  }

  /* ── film strip ───────────────────────────────────────────────────────
     `.strip-item` and `.t` are the ONLY class-name selectors in the entire
     automated visual gate (shoot.js:138) and they are written HERE. Renaming
     either used to end a shoot silently — zero screenshots, zero overflow
     checks, "no overflow, no page errors", exit 0. They are load-bearing names,
     not styling hooks; the icon below is ADDED ALONGSIDE them rather than
     wrapping or replacing either.

     The icon is the scene's own glyph at 18px and it is not decoration: this is
     a twelve-row list in a 310px column (244px under 1240) where `.t` truncates
     with an ellipsis, so on a narrow panel the glyph is frequently the only
     part of a row that still identifies the scene. */
  _buildStrip() {
    this.el.list.innerHTML = '';
    SCENES.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'strip-item';
      b.type = 'button';
      b.innerHTML = `<span class="n">${i + 1}</span>` +
        `<span class="ico">${dxcIcon(s.icon, 18)}</span>` +
        `<span class="t">${s.title}</span>` +
        (s.flag ? `<span class="flag">${s.flag}</span>` : '');
      b.addEventListener('click', () => this.goto(s.id, { play: this.playing }));
      this.el.list.appendChild(b);
    });
  }

  _syncStrip() {
    [...this.el.list.children].forEach((b, i) => {
      b.classList.toggle('current', i === this.i);
      b.classList.toggle('seen', this.seen.has(i) && i !== this.i);
    });
    this.el.counter.textContent = `scene ${this.i + 1} / ${SCENES.length}`;
    this.el.progress.style.width = `${((this.i + 1) / SCENES.length) * 100}%`;
    const cur = this.el.list.children[this.i];
    cur?.scrollIntoView({ block: 'nearest' });
  }

  /* ── scene rendering ──────────────────────────────────────────────── */

  render(i, { play = true } = {}) {
    this.token++;
    this.leaveHooks.forEach(fn => { try { fn(); } catch {} });
    this.leaveHooks = [];
    this.lineHooks = new Map();
    // One call for both halves: cancel() stops the sound AND the face, whichever
    // backend is up, and resolves the say() that was in flight.
    this.presenter?.cancel();

    this.i = Math.max(0, Math.min(SCENES.length - 1, i));
    this.seen.add(this.i);
    const scene = SCENES[this.i];

    /* Scene 1's title IS the product name, and it collides on TWO surfaces.

       The header is the one that matters. The lockup already prints the product
       a few pixels to the left, so assigning the title here spelled the name
       twice across the top of the FIRST frame a client sees, separated only by
       the hairline rule — and the tab, which nobody in the room is looking at,
       was the only surface guarded. One guard, both surfaces, applied to the
       header first.

       It falls back to the walkthrough wording rather than to nothing. Empty is
       tempting — the lockup does name the product — but the rule between the two
       is drawn by this element's OWN border-left, with 16px of padding behind
       it, so an empty string leaves a hairline and 22px of dead air hanging off
       the lockup. And this slot is the viewer's "where am I" readout on the
       other eleven scenes; blanking it on scene 1 alone reads as a scene that
       failed to load rather than as a deliberate space. So: the lockup says what
       the product is, and this says what you are watching. It is also the exact
       wording the tab has always used, which is the point — the two halves of
       the header now agree instead of disagreeing five lines apart.

       Fixed HERE, at the render site, and deliberately not in src/scenes.js: the
       scene's title is also its filmstrip label and the slug shoot.js builds its
       screenshot filenames from, and neither of those wants to be "Walkthrough". */
    this.el.title.textContent = scene.title === PRODUCT ? 'Walkthrough' : scene.title;
    document.title = scene.title === PRODUCT
      ? `${PRODUCT} — walkthrough`
      : `${scene.title} — ${PRODUCT}`;
    this.el.stage.scrollTop = 0;
    this.el.stage.innerHTML = `<div class="scene">${scene.html()}</div>`;

    scene.enter?.({
      root: this.el.stage,
      goto: (id, o) => this.goto(id, o),
      ask: q => this.handleAsk(q),
      onLeave: fn => this.leaveHooks.push(fn),
      onLine: (n, fn) => this.lineHooks.set(n, fn),
    });

    this._syncStrip();
    this.line = 0;
    /* Drop the flag before asking to play. play() guards against two narration
       loops running at once with `if (this.playing) return`, but a scene change
       is not a second loop — it IS the loop moving on, and this.token was
       bumped at the top of render() so the old one is already dead. Without
       this the guard swallows every auto-advance: scene 1 narrates, scene 2
       renders, and the deck then sits there with playing=true, the button
       reading "Pause presentation", and nothing speaking. Only the play branch
       touches it, so the cold open's "Start presentation" copy is unchanged. */
    if (play) { this.playing = false; this.play(); }
    else this._setState('idle');
  }

  goto(id, opts = {}) {
    const i = typeof id === 'number' ? id : sceneIndex(id);
    if (i >= 0) this.render(i, opts);
  }

  next() {
    if (this.i < SCENES.length - 1) this.render(this.i + 1, { play: this.playing });
    else this.pause();
  }
  prev() { this.render(Math.max(0, this.i - 1), { play: this.playing }); }

  /* ── narration ────────────────────────────────────────────────────── */

  async play() {
    if (this.playing) return;
    this.playing = true;
    this._syncPlayBtn();
    const my = ++this.token;
    const scene = SCENES[this.i];

    // Normally already resolved long before anyone presses start; this is for
    // the viewer who clicks inside the first second. See _attach().
    if (!this.presenter) {
      await this.ready;
      if (my !== this.token) return;
    }

    for (let n = this.line; n < scene.lines.length; n++) {
      if (my !== this.token) return;
      this.line = n;
      const text = scene.lines[n];

      this._caption(text);
      this.lineHooks.get(n)?.();
      this._setState('speaking');

      await this.presenter.say(text);
      if (my !== this.token) return;

      this._captionDone();
      await wait(340);
      if (my !== this.token) return;
    }

    this._setState('idle');
    this.line = 0;
    if (this.i < SCENES.length - 1) {
      await wait(700);
      if (my !== this.token) return;
      this.render(this.i + 1, { play: true });
    } else {
      this.pause();
      this._caption('That’s the tour. Ask me anything you like — I’m still here.');
    }
  }

  pause() {
    this.playing = false;
    this.token++;
    this.presenter?.cancel();
    this._setState('idle');
    this._syncPlayBtn();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /* The transport button is a GLYPH plus a LABEL, and the two are swapped
     separately. It used to be ONE textContent assignment, with the play and
     pause characters living inside the string — which is why this is worth a
     note: setting textContent on the button now would delete the svg with it,
     and the button would lose its icon on the very first press and never get it
     back. Write to the two children, never to the button. */
  _syncPlayBtn() {
    const ico = this.el.play.querySelector('.ico');
    const lbl = this.el.play.querySelector('.lbl');
    if (ico) ico.innerHTML = dxcIcon(this.playing ? 'pause' : 'play', 15);
    if (lbl) lbl.textContent = this.playing ? 'Pause presentation' : 'Resume presentation';
    this.el.play.classList.toggle('primary', !this.playing);
  }

  /* One span per word, so the 3D backend's word-timed subtitles can light the
     line up as it is spoken (see _word). Whitespace stays as text nodes so the
     caption still wraps and reads exactly as it did. textContent per token
     rather than innerHTML — an answer's spoken form comes back from a model,
     and this element is not a place to hand it markup. */
  _caption(text) {
    this.el.caption.classList.remove('idle');
    const frag = document.createDocumentFragment();
    for (const tok of String(text).split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) { frag.append(tok); continue; }
      const w = document.createElement('span');
      w.textContent = tok;
      frag.append(w);
    }
    this.el.caption.replaceChildren(frag);
    this.words = [...this.el.caption.children];
    this.wordAt = 0;
    this.el.caption.parentElement.scrollTop = 0;
  }

  /* TalkingHead's onsubtitles, one word at a time, on its own audio clock. It
     hands over a STRING, and its stream is tokenised by whoever produced the
     timings (ElevenLabs' alignment, or our own split when there was none), so
     this walks the spans in ORDER rather than matching their text — order
     cannot drift out of step, a content match can. The canvas backend has no
     word clock and never calls this, so there the caption stays as it has
     always been: one static, fully-lit line. */
  _word() {
    this.words[this.wordAt++]?.classList.add('said');
  }

  /* A line that ran to the end is fully said, whatever the timings covered —
     otherwise a stream that stops a word or two short leaves the tail dimmed
     and reads as a caption that stalled. NOT called on an interruption: there
     the half-lit line is the truth. */
  _captionDone() {
    for (const w of this.words) w.classList.add('said');
    this.wordAt = this.words.length;
  }

  _setState(s) {
    this.presenter?.setState(s);
    this.el.state.dataset.state = s;
    this.el.state.querySelector('.label').textContent =
      s === 'speaking' ? 'speaking' : s === 'listening' ? 'listening' : s === 'thinking' ? 'thinking' : 'standing by';
  }

  /* ── questions ────────────────────────────────────────────────────── */

  async handleAsk(question) {
    const q = String(question || '').trim();
    if (!q) return;

    const wasPlaying = this.playing;
    this.pause();
    this.el.askInput.value = '';

    this.el.ansQ.textContent = q.length > 110 ? q.slice(0, 107) + '…' : q;
    this.el.ansBody.innerHTML = `<p style="color:var(--ink-3)">Looking that up…</p>`;
    this.el.answer.classList.add('open');
    this._setState('thinking');
    this._caption('Let me take that.');

    const my = ++this.token;
    const { html, scene, via } = await this.ask.answer(q);
    if (my !== this.token) return;

    /* An answer names a scene to offer as a jump, and knowledge.js holds 38 of
       those ids by hand against scenes.js's twelve. sceneIndex() answers -1 for
       one that no longer exists, SCENES[-1] is undefined, and reading .title off
       it threw a TypeError — inside an async handler nobody awaits, so it was
       unhandled, the two lines below never ran, and the answer sheet sat on
       "Looking that up…" for the rest of the meeting with the real answer
       already in hand. Resolve the scene to an OBJECT and let an unknown id
       simply yield no jump button: a missing button loses nothing, and the
       answer — which is the thing the viewer asked for — still lands.
       data-jump comes off the resolved scene, so it can only ever be real. */
    const target = scene && scene !== SCENES[this.i].id ? SCENES[sceneIndex(scene)] : null;
    if (scene && !target && scene !== SCENES[this.i].id) {
      console.warn(`[app] answer pointed at unknown scene id "${scene}" — no jump offered.` +
        ' src/knowledge.js has a scene id that src/scenes.js does not.');
    }
    /* The jump chip wears its DESTINATION's glyph — the same one that row has
       in the navigator — so "where would this take me" is answerable before
       reading the label. It is read off the RESOLVED scene object, like the id
       beside it, so it cannot name a scene that is not there.

       The label is still the scene's own title and nothing else: the pinned-id
       half of tests/guards.test.mjs asserts the button NAMES the scene it will
       take you to, and it reads button.textContent — which an <svg> contributes
       nothing to, because none of these icons carries a <title>. */
    const jump = target
      ? `<button class="jump" data-jump="${target.id}">${dxcIcon(target.icon, 14)}<span>${target.title}</span></button>`
      : '';
    const resume = wasPlaying
      ? `<button class="jump" data-resume="1">${dxcIcon('play', 14)}<span>Resume the walkthrough</span></button>` : '';

    this.el.ansBody.innerHTML = html + (jump || resume ? `
      <div class="ans-src">
        <span class="lbl">${dxcIcon('checklist', 13)}${via === 'llm' ? 'answered by Iris · grounded' : 'answered from the briefing'}</span>
        ${jump}${resume}
      </div>` : '');

    this.el.ansBody.querySelector('[data-jump]')?.addEventListener('click', e => {
      this._closeAnswer();
      this.goto(e.currentTarget.dataset.jump, { play: true });
    });
    this.el.ansBody.querySelector('[data-resume]')?.addEventListener('click', () => {
      this._closeAnswer();
      this.play();
    });

    // speak the answer
    if (!this.presenter) {
      await this.ready;
      if (my !== this.token) return;
    }
    const spoken = spokenForm(html);
    this._caption(spoken.length > 240 ? spoken.slice(0, 237) + '…' : spoken);
    this._setState('speaking');
    await this.presenter.say(spoken);
    if (my !== this.token) return;
    this._captionDone();
    this._setState('idle');
  }

  _closeAnswer() { this.el.answer.classList.remove('open'); }

  /* ── wiring ───────────────────────────────────────────────────────── */

  _wire() {
    this.el.play.addEventListener('click', () => this.toggle());
    this.el.back.addEventListener('click', () => this.prev());
    this.el.skip.addEventListener('click', () => this.next());
    /* The strip's own step-back / step-forward. They sit either side of the
       transport button, where a viewer looks for them, and they are the two
       controls on the page that are a glyph and nothing else — so the aria-label
       is on the BUTTON in index.html, and the icons stay aria-hidden. */
    this.el.prev?.addEventListener('click', () => this.prev());
    this.el.next?.addEventListener('click', () => this.next());
    this.el.ansClose.addEventListener('click', () => this._closeAnswer());

    this.el.askForm.addEventListener('submit', e => {
      e.preventDefault();
      this.handleAsk(this.el.askInput.value);
    });

    /* presenter.setMuted(), NOT voice.setMuted(). Once the 3D backend is up it
       owns playback, so the buffer is inside TalkingHead's own audio graph and
       voice.stop() has no handle on th.audioSpeechSource — muting Voice alone
       would leave the room listening to a presenter it had just silenced.
       Presenter mutes Voice AND takes the mixer gain to zero. The flag is kept
       here rather than read back off the presenter so the button still works in
       the first second, before _attach() resolves.

       And it says so in WORDS, not in a glyph. The DXC pack has no speaker, no
       mute and no waveform, and the nearest lookalike from any other set would
       be a different designer's drawing sitting next to 48 that are not. Same
       for the theme toggle below: no sun, no moon, no half-filled circle. Both
       buttons read as what they do. */
    this.el.mute.addEventListener('click', () => {
      this.muted = !this.muted;
      this.presenter?.setMuted(this.muted);
      this.el.mute.setAttribute('aria-pressed', String(!this.muted));
      this.el.mute.textContent = this.muted ? 'Sound off' : 'Sound on';
    });

    try {
      const saved = localStorage.getItem('aib-theme');
      if (saved) document.documentElement.dataset.theme = saved;
    } catch {}
    // The button names the theme it will SWITCH TO, which is why it reads
    // "Light" on the dark deck that ships by default.
    const syncTheme = () => {
      this.el.theme.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
    };
    syncTheme();
    this.el.theme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('aib-theme', next); } catch {}
      syncTheme();
    });

    // voice input
    const rec = createRecogniser({
      onResult: (text, final) => {
        this.el.askInput.value = text;
        if (final) { this.el.mic.classList.remove('rec'); this.handleAsk(text); }
      },
      onEnd: () => { this.el.mic.classList.remove('rec'); if (!this.playing) this._setState('idle'); },
    });
    if (!rec) this.el.mic.disabled = true, this.el.mic.title = 'Speech input is not available in this browser';
    this.el.mic.addEventListener('click', () => {
      if (!rec) return;
      if (this.el.mic.classList.contains('rec')) { rec.stop(); return; }
      this.pause();
      this.el.mic.classList.add('rec');
      this._setState('listening');
      this._caption('I’m listening.');
      try { rec.start(); } catch { this.el.mic.classList.remove('rec'); }
    });

    // keyboard transport — ignored while typing
    addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if (e.key === 'Escape') { this._closeAnswer(); if (typing) e.target.blur(); return; }
      if (typing) return;
      if (e.key === ' ') { e.preventDefault(); this.toggle(); }
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === '/') { e.preventDefault(); this.el.askInput.focus(); }
    });

    // cold open — the click here is what unlocks audio autoplay
    $('#startBtn').addEventListener('click', () => {
      this.el.overlay.hidden = true;
      this.render(0, { play: true });
    });
    $('#skipIntroBtn').addEventListener('click', () => {
      this.el.overlay.hidden = true;
      this.render(1, { play: false });
      this.el.askInput.focus();
    });
  }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/* Hydrate the shell's icon placeholders BEFORE the App is constructed.
   index.html ships `data-dxc-icon="step-back"` rather than 300 characters of
   bezier, so the path data exists exactly once (src/icons.js) and the shell
   stays readable. Doing it here, synchronously, ahead of `new App()`, is what
   guarantees nothing is ever measured or photographed mid-hydration: shoot.js
   and every browser suite wait on `window.app`, which does not exist until the
   line below has finished. */
window.addEventListener('DOMContentLoaded', () => {
  dxcHydrate(document);
  window.app = new App();
});
