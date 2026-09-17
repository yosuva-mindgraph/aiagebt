/* ============================================================================
   The controller.

   Owns the transport (play / pause / back / skip / jump), mounts a scene's
   stage, runs its narration line by line through the voice, keeps the caption
   and the film strip in step, and handles a question at any moment — which
   pauses the walkthrough, answers, and offers to resume.
   ========================================================================== */

import { SCENES, sceneIndex } from './scenes.js';
import { Avatar } from './avatar.js';
import { Voice, createRecogniser, estimate } from './voice.js';
import { Ask, spokenForm } from './ask.js';

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

    this.voice = new Voice(CONFIG);
    this.ask = new Ask(CONFIG);
    this.avatar = new Avatar($('#avatar'));
    this.voice.onLevel = v => this.avatar.setLevel(v);

    this.el = {
      stage: $('#stage'), title: $('#sceneTitle'), caption: $('#captionText'),
      list: $('#sceneList'), counter: $('#sceneCounter'), progress: $('#progressFill'),
      play: $('#playBtn'), back: $('#backBtn'), skip: $('#skipBtn'),
      mute: $('#muteBtn'), theme: $('#themeBtn'),
      answer: $('#answer'), ansBody: $('#ansBody'), ansQ: $('#ansQ'), ansClose: $('#ansClose'),
      askForm: $('#askForm'), askInput: $('#askInput'), mic: $('#micBtn'),
      state: $('#avatarState'), overlay: $('#overlay'),
    };

    this._buildStrip();
    this._wire();
    this._setState('idle');
    this.el.caption.classList.add('idle');
    this.el.caption.textContent = 'Press start and I’ll take you through it. Stop me with a question whenever you like.';
    this.render(0, { play: false });
  }

  /* ── film strip ───────────────────────────────────────────────────── */

  _buildStrip() {
    this.el.list.innerHTML = '';
    SCENES.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'strip-item';
      b.type = 'button';
      b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${s.title}</span>` +
        (s.flag ? `<span class="flag">● ${s.flag}</span>` : '');
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
    this.voice.stop();
    this.avatar.stopSpeaking();

    this.i = Math.max(0, Math.min(SCENES.length - 1, i));
    this.seen.add(this.i);
    const scene = SCENES[this.i];

    this.el.title.textContent = scene.title;
    document.title = `${scene.title} — Airport in a Box`;
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
    if (play) this.play(); else this._setState('idle');
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

    for (let n = this.line; n < scene.lines.length; n++) {
      if (my !== this.token) return;
      this.line = n;
      const text = scene.lines[n];

      this._caption(text);
      this.lineHooks.get(n)?.();
      this._setState('speaking');
      this.avatar.speak(text, estimate(text));

      await this.voice.say(text);
      if (my !== this.token) return;

      this.avatar.stopSpeaking();
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
    this.voice.stop();
    this.avatar.stopSpeaking();
    this._setState('idle');
    this._syncPlayBtn();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  _syncPlayBtn() {
    this.el.play.textContent = this.playing ? '⏸ Pause presentation' : '▸ Resume presentation';
    this.el.play.classList.toggle('primary', !this.playing);
  }

  _caption(text) {
    this.el.caption.classList.remove('idle');
    this.el.caption.textContent = text;
    this.el.caption.parentElement.scrollTop = 0;
  }

  _setState(s) {
    this.avatar.setState(s);
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

    const jump = scene && scene !== SCENES[this.i].id
      ? `<button class="jump" data-jump="${scene}">Take me to “${SCENES[sceneIndex(scene)].title}” →</button>`
      : '';
    const resume = wasPlaying
      ? `<button class="jump" data-resume="1">↩ Resume the walkthrough</button>` : '';

    this.el.ansBody.innerHTML = html + (jump || resume ? `
      <div class="ans-src">
        <span class="lbl">${via === 'llm' ? 'answered by Iris · grounded' : 'answered from the briefing'}</span>
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
    const spoken = spokenForm(html);
    this._caption(spoken.length > 240 ? spoken.slice(0, 237) + '…' : spoken);
    this._setState('speaking');
    this.avatar.speak(spoken, estimate(spoken));
    await this.voice.say(spoken);
    if (my !== this.token) return;
    this.avatar.stopSpeaking();
    this._setState('idle');
  }

  _closeAnswer() { this.el.answer.classList.remove('open'); }

  /* ── wiring ───────────────────────────────────────────────────────── */

  _wire() {
    this.el.play.addEventListener('click', () => this.toggle());
    this.el.back.addEventListener('click', () => this.prev());
    this.el.skip.addEventListener('click', () => this.next());
    this.el.ansClose.addEventListener('click', () => this._closeAnswer());

    this.el.askForm.addEventListener('submit', e => {
      e.preventDefault();
      this.handleAsk(this.el.askInput.value);
    });

    this.el.mute.addEventListener('click', () => {
      const m = !this.voice.muted;
      this.voice.setMuted(m);
      this.el.mute.setAttribute('aria-pressed', String(!m));
      this.el.mute.textContent = m ? '🔇 Sound off' : '🔊 Sound on';
    });

    try {
      const saved = localStorage.getItem('aib-theme');
      if (saved) document.documentElement.dataset.theme = saved;
    } catch {}
    this.el.theme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('aib-theme', next); } catch {}
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

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
