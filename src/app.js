/* ============================================================================
   The controller.

   Owns the transport (play / pause / back / skip / jump), mounts a scene's
   stage, runs its narration line by line through the voice, keeps the caption
   and the film strip in step, and handles a question at any moment — which
   pauses the walkthrough, answers (with figures), and offers to resume.
   ========================================================================== */

import { SCENES, sceneIndex } from './scenes.js';
import { Avatar } from './avatar.js';
import { Voice, createRecogniser, estimate } from './voice.js';
import { Ask, spokenForm } from './ask.js';

const $ = sel => document.querySelector(sel);

const CONFIG = window.AIB_CONFIG || {};

const STATE_LABEL = {
  idle: 'ready when you are',
  speaking: 'speaking',
  listening: 'listening…',
  thinking: 'thinking…',
};

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
      answer: $('#answer'), ansBody: $('#ansBody'), ansFigs: $('#ansFigs'), ansQ: $('#ansQ'), ansClose: $('#ansClose'),
      askForm: $('#askForm'), askInput: $('#askInput'), mic: $('#micBtn'), micCancel: $('#micCancel'), voiceSeg: $('#voiceSeg'),
      state: $('#avatarState'), overlay: $('#overlay'),
    };

    this._buildStrip();
    this._wire();
    this._setState('idle');
    this.el.caption.classList.add('idle');
    this.el.caption.textContent = 'Hi, I’m AIRIS. Press start and I’ll walk you through it — or just ask me something.';
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
    countUpAll(this.el.stage);

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

      // generate the next line while this one plays, so a slow voice never leaves a gap
      this.voice.prefetch(scene.lines[n + 1] ?? SCENES[this.i + 1]?.lines[0]);
      await this.voice.say(text);
      if (my !== this.token) return;

      this.avatar.stopSpeaking();
      await wait(300);
      if (my !== this.token) return;
    }

    this._setState('idle');
    this.line = 0;
    if (this.i < SCENES.length - 1) {
      await wait(600);
      if (my !== this.token) return;
      this.render(this.i + 1, { play: true });
    } else {
      this.pause();
      this._caption('That’s the tour. I’m still here — ask me anything you like.');
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
    this.el.play.textContent = this.playing ? '⏸ Pause' : '▸ Resume the walkthrough';
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
    this.el.state.querySelector('.label').textContent = STATE_LABEL[s] || STATE_LABEL.idle;
  }

  /* ── questions ────────────────────────────────────────────────────── */

  async handleAsk(question) {
    const q = String(question || '').trim();
    if (!q) return;

    const wasPlaying = this.playing;
    this.pause();
    this.el.askInput.value = '';

    this.el.ansQ.textContent = q.length > 110 ? q.slice(0, 107) + '…' : q;
    this.el.ansBody.innerHTML = `<p class="thinking"><span></span><span></span><span></span> Let me have a look…</p>`;
    this.el.ansFigs.hidden = true;
    this.el.answer.classList.add('open');
    this._setState('thinking');
    this._caption('Ooh, good question. One second.');

    const my = ++this.token;
    const { html, scene, via, visual, grounded } = await this.ask.answer(q);
    if (my !== this.token) return;

    const jump = scene && scene !== SCENES[this.i].id
      ? `<button class="jump" data-jump="${scene}">Show me “${SCENES[sceneIndex(scene)].title}” →</button>`
      : '';
    const resume = wasPlaying
      ? `<button class="jump" data-resume="1">↩ Carry on with the tour</button>` : '';

    const label = via === 'llm' && !grounded ? 'AIRIS · not in the briefing'
      : via === 'llm' ? 'AIRIS · grounded in the briefing'
      : via === 'local-fallback' ? 'straight from the briefing (offline)'
      : 'straight from the briefing';

    this.el.ansBody.innerHTML = html + `
      <div class="ans-src">
        <span class="lbl">${label}</span>
        ${jump}${resume}
      </div>`;

    this._renderFigures(visual);

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

  /** The figures panel beside an answer: icon, up to four numbers, sources, two related questions. */
  _renderFigures(visual) {
    const v = visual || {};
    const facts = v.facts || [];
    const related = v.related || [];
    const sources = v.sources || [];
    if (!facts.length && !related.length && !sources.length) { this.el.ansFigs.hidden = true; return; }

    const tiles = facts.map(f => `
      <div class="fig${f.human ? ' human' : ''}"><div class="fn" data-n="${esc(f.n)}">${esc(f.n)}</div><div class="fl">${esc(f.l)}</div></div>`).join('');
    const src = sources.length
      ? `<div class="fig-src"><span class="lbl">from</span>${sources.map(s => `<span class="cite">${esc(s)}</span>`).join('')}</div>` : '';
    const also = related.length
      ? `<div class="also"><span class="lbl">you could also ask</span>${related.map(r => `<button type="button" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : '';

    this.el.ansFigs.innerHTML = `
      <div class="fig-icon" aria-hidden="true">${v.icon || '✈️'}</div>
      ${tiles ? `<div class="fig-tiles">${tiles}</div>` : ''}
      ${src}${also}`;
    this.el.ansFigs.hidden = false;
    countUpAll(this.el.ansFigs);
    this.el.ansFigs.querySelectorAll('[data-q]').forEach(b =>
      b.addEventListener('click', () => this.handleAsk(b.dataset.q)));
  }

  _closeAnswer() { this.el.answer.classList.remove('open'); }

  /* ── the voice switch ─────────────────────────────────────────────── */

  _buildVoiceSwitch() {
    const personas = this.voice.personas;
    if (!this.voice.usingElevenLabs || personas.length < 2) { this.el.voiceSeg.hidden = true; return; }
    let saved = null;
    try { saved = localStorage.getItem('aib-voice'); } catch {}
    if (saved && this.voice.setPersona(saved)) {} else saved = this.voice.persona;

    this.el.voiceSeg.innerHTML = `<span class="lbl">voice</span>` + personas.map(p =>
      `<button type="button" data-persona="${p.id}" aria-pressed="${p.id === saved}" title="${p.label} — ${p.gender || 'voice'}">${p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '•'} ${p.label}</button>`).join('');
    this.el.voiceSeg.hidden = false;

    this.el.voiceSeg.querySelectorAll('[data-persona]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.persona;
      if (id === this.voice.persona || !this.voice.setPersona(id)) return;
      try { localStorage.setItem('aib-voice', id); } catch {}
      this.el.voiceSeg.querySelectorAll('[data-persona]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.persona === id)));
      const p = personas.find(x => x.id === id);
      // a one-line hello in the new voice, unless the walkthrough is mid-sentence
      if (!this.playing) {
        const hello = `${p.label} here. Ask me anything.`;
        this._caption(hello);
        this._setState('speaking');
        this.avatar.speak(hello, estimate(hello));
        const my = ++this.token;
        this.voice.say(hello).then(() => { if (my === this.token) { this.avatar.stopSpeaking(); this._setState('idle'); } });
      }
    }));
  }

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

    // voice input — ElevenLabs Scribe when a key is present, the browser's own recognition otherwise
    const micIdle = () => {
      this.el.mic.classList.remove('rec');
      this.el.mic.textContent = '🎤 Speak';
      this.el.micCancel.hidden = true;
      if (!this.playing) this._setState('idle');
    };
    const rec = createRecogniser(CONFIG, {
      onResult: (text, final) => {
        this.el.askInput.value = text;
        if (final) { micIdle(); if (text.trim()) this.handleAsk(text); }
      },
      onStatus: msg => this._caption(msg),
      onError: msg => { micIdle(); this._caption(msg); },
      onEnd: () => micIdle(),
    });
    if (!rec) { this.el.mic.disabled = true; this.el.mic.title = 'Speech input is not available in this browser'; }
    else { this.el.mic.title = rec.kind === 'scribe' ? 'Ask out loud — AIRIS listens through ElevenLabs' : 'Ask out loud'; this.el.mic.dataset.kind = rec.kind; }
    this.el.mic.addEventListener('click', () => {
      if (!rec) return;
      if (this.el.mic.classList.contains('rec')) { rec.stop(); return; }
      this.pause();
      this.el.mic.classList.add('rec');
      this.el.mic.textContent = '● Listening… tap when done';
      this.el.micCancel.hidden = false;
      this._setState('listening');
      this._caption('I’m listening — go ahead.');
      try { rec.start(); } catch (err) { micIdle(); this._caption('I couldn’t open the microphone — type it in and I’ll answer.'); }
    });
    this.el.micCancel.addEventListener('click', () => {
      if (rec?.cancel) rec.cancel(); else rec?.stop();
      micIdle();
      this._caption('Okay, cancelled.');
    });

    // voice switch — Friday / Jarvis — remembered on this machine
    this._buildVoiceSwitch();

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
    // Warm the voice cache for the whole deck once the visitor is in — the first
    // tour of the day then has no generation gaps, and every later one is free.
    const prewarm = () => this.voice.prewarm(SCENES.flatMap(s => s.lines));
    $('#startBtn').addEventListener('click', () => {
      this.el.overlay.hidden = true;
      this.render(0, { play: true });
      prewarm();
    });
    $('#skipIntroBtn').addEventListener('click', () => {
      this.el.overlay.hidden = true;
      this.render(1, { play: false });
      this.el.askInput.focus();
      prewarm();
    });
  }
}

/* ── count-up figures ─────────────────────────────────────────────────
   Any element with data-n="83" / "~85%" / "201" / "$13.6k" counts up from
   zero on arrival, keeping its prefix and suffix. Non-numeric values are
   left alone. Honours prefers-reduced-motion.                            */

const REDUCED = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

function countUpAll(root) {
  root.querySelectorAll('[data-n]').forEach(countUp);
}

function countUp(el) {
  const raw = el.dataset.n || '';
  // "58", "~85%", "5.5M", "70+", "$13.6k" animate; "C120", "Oct 2025", "1990s", "23–24", "10:20" do not
  const m = raw.match(/^([~≈$€£+]?)(\d[\d,]*)(\.\d+)?([%+kKMx×]?)$/);
  if (!m || REDUCED) { el.textContent = raw; return; }
  const [, pre, intPart, dec = '', post] = m;
  const target = parseFloat(intPart.replace(/,/g, '') + dec);
  if (!dec && !post && !pre && target >= 1900 && target <= 2100) { el.textContent = raw; return; }   // a year
  const decimals = dec ? dec.length - 1 : 0;
  const grouped = intPart.includes(',');
  const t0 = performance.now();
  const dur = 700 + Math.min(500, target * 2);
  const fmt = v => {
    let s = v.toFixed(decimals);
    if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return pre + s + post;
  };
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
  };
  el.textContent = fmt(0);
  requestAnimationFrame(tick);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wait = ms => new Promise(r => setTimeout(r, ms));

window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
