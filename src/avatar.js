/* ============================================================================
   AIRIS — the presenter.

   A holographic core, not a face. The briefing says "like the iris of an eye,
   AIRIS enables an airport to SEE and understand its operations", so the
   centre of this is an aperture: a glowing iris with a ring of blades, inside
   rotating rings of ticks, arcs and brackets, a circular voice-meter that
   moves when AIRIS speaks, and a slow field of orbiting particles.

   It is lit sky when the platform is speaking or waiting, and gold when it is
   the human's turn (listening) — the same rule the rest of the page holds to.
   Thinking is peach, and the rings spin faster while it thinks.

   States: idle · speaking · listening · thinking
   Voice: when a real audio buffer is playing (ElevenLabs), setLevel() drives
   the meter from actual RMS; otherwise an energy track derived from the text's
   visemes is advanced on a clock that matches the utterance length.

   Public surface (keep it — app.js and any future avatar swap rely on it):
     setState(s) · speak(text, durationMs) · stopSpeaking() · setLevel(rms)
   ========================================================================== */

/* Viseme set, kept for the text-driven energy track. Open vowels carry the
   most energy, closed consonants the least. */
const VISEME_ENERGY = {
  rest: 0.05, AA: 1.0, E: 0.75, I: 0.55, O: 0.9, U: 0.7, FV: 0.3, MBP: 0.1, L: 0.6, S: 0.35,
};

const CHAR_VISEME = {
  a: 'AA', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I',
  m: 'MBP', b: 'MBP', p: 'MBP',
  f: 'FV', v: 'FV',
  s: 'S', z: 'S', c: 'S', x: 'S', j: 'S',
  l: 'L', n: 'L', d: 'L', t: 'L', r: 'L', k: 'L', g: 'L', h: 'L', w: 'U', q: 'U',
};

/** Text → a list of visemes, one per letter-ish, with rests at word gaps. */
export function visemesFor(text) {
  const out = [];
  for (const word of String(text || '').toLowerCase().split(/\s+/)) {
    let last = null;
    for (const ch of word) {
      const v = CHAR_VISEME[ch];
      if (!v) continue;
      if (v !== last) out.push(v);
      last = v;
    }
    out.push('rest');
  }
  return out.length ? out : ['rest'];
}

const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/* a cheap, stable pseudo-random per index — the particles and bars must not
   re-roll every frame */
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class Avatar {
  constructor(canvas, { name = 'AIRIS' } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.name = name;
    this.state = 'idle';
    this.track = ['rest'];
    this.trackStart = 0;
    this.trackDur = 0;
    this.level = null;          // external RMS 0..1, when real audio drives it

    this.energy = 0;            // eased 0..1 — drives the meter, the glow and the core size
    this.spin = 0;              // accumulated rotation, so speed changes never jump
    this.pings = [];            // listening sonar rings (start times)
    this.lastPing = 0;
    this.sweepAt = 0;           // next idle scan sweep
    this.particles = Array.from({ length: 48 }, (_, i) => ({
      r: 0.29 + hash(i) * 0.19,             // orbit radius, as a fraction of S
      a: hash(i + 100) * TAU,               // angle
      s: (0.05 + hash(i + 200) * 0.12) * (hash(i + 300) > 0.5 ? 1 : -1),   // rad/s
      z: 0.5 + hash(i + 400) * 1.5,         // size px
      ph: hash(i + 500) * TAU,              // twinkle phase
    }));

    this.colors = null;
    this.colorsAt = 0;
    this.t0 = performance.now();
    this.raf = null;
    this.reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    addEventListener('resize', this._resize);
    this._resize();
    this.raf = requestAnimationFrame(this._frame);
  }

  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this._resize); }

  setState(s) {
    if (s === 'listening' && this.state !== 'listening') { this.pings.push(performance.now()); this.lastPing = performance.now(); }
    this.state = s;
  }

  /** Start "speaking" `text` over `durationMs` — the meter follows the text. */
  speak(text, durationMs) {
    this.track = visemesFor(text);
    this.trackStart = performance.now();
    this.trackDur = Math.max(400, durationMs || this.track.length * 62);
    this.state = 'speaking';
  }

  stopSpeaking() { this.track = ['rest']; this.trackDur = 0; this.level = null; if (this.state === 'speaking') this.state = 'idle'; }

  /** Optional: drive the meter from real audio RMS (0..1). */
  setLevel(v) { this.level = v; }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, Math.round(r.width * dpr));
    this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
    this.w = r.width; this.h = r.height;
  }

  /* brand tokens, re-read once a second so the theme toggle is honoured */
  _palette(now) {
    if (this.colors && now - this.colorsAt < 1000) return this.colors;
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    this.colors = { sky: v('--sky') || '#a1e6ff', gold: v('--gold') || '#ffae41', peach: v('--peach') || '#ffc982', royal: v('--royal') || '#004aac', ink3: v('--ink-3') || '#7b82a6', light: document.documentElement.dataset.theme === 'light' };
    this.colorsAt = now;
    return this.colors;
  }

  _energyTarget(now) {
    const t = (now - this.t0) / 1000;
    if (this.state === 'speaking') {
      if (this.level != null) return Math.min(1, this.level * 2.4);
      const el = now - this.trackStart;
      if (el > this.trackDur) return 0.08;
      const i = Math.min(this.track.length - 1, Math.floor(el / this.trackDur * this.track.length));
      const e = VISEME_ENERGY[this.track[i]] ?? 0.3;
      return e * (0.8 + 0.2 * Math.sin(el / 53));            // never metronomic
    }
    if (this.state === 'thinking') return 0.32 + 0.12 * Math.sin(t * 5.5);
    if (this.state === 'listening') return 0.22 + 0.06 * Math.sin(t * 2.2);
    return 0.10 + 0.04 * Math.sin(t * 1.1);                   // breathing
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const ctx = this.ctx;
    const W = this.w || this.c.width, H = this.h || this.c.height;
    const S = Math.min(W, H) * 0.9;                            // leave room for the state label at the foot
    const cx = W / 2, cy = H * 0.47;
    const t = (now - this.t0) / 1000;
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000); this._last = now;
    const P = this._palette(now);
    const accent = this.state === 'listening' ? P.gold : this.state === 'thinking' ? P.peach : P.sky;
    const faint = P.light ? 0.55 : 1;                        // light theme needs a touch less glow

    // ease the energy; spin speed depends on state
    const k = this.reduced ? 1 : 0.28;
    this.energy = lerp(this.energy, this._energyTarget(now), k);
    const speed = this.reduced ? 0 : this.state === 'thinking' ? 3.2 : this.state === 'speaking' ? 1.25 : 1;
    this.spin += dt * speed;
    const E = this.energy;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // ── ambient glow ──────────────────────────────────────────────────
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.55);
    glow.addColorStop(0, rgba(accent, (0.16 + E * 0.16) * faint));
    glow.addColorStop(0.45, rgba(P.royal, 0.10 * faint));
    glow.addColorStop(1, rgba(P.royal, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── polar grid, very faint ────────────────────────────────────────
    ctx.strokeStyle = rgba(P.ink3, 0.10);
    ctx.lineWidth = 1;
    for (const r of [0.20, 0.35, 0.48]) { ctx.beginPath(); ctx.arc(cx, cy, S * r, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * S * 0.20, cy + Math.sin(a) * S * 0.20);
      ctx.lineTo(cx + Math.cos(a) * S * 0.48, cy + Math.sin(a) * S * 0.48); ctx.stroke();
    }

    // ── idle scan sweep — a slow radar sector every few seconds ───────
    if (this.state === 'idle' && !this.reduced) {
      if (now > this.sweepAt) this.sweepAt = now + 4200 + hash(Math.floor(now / 1000)) * 3000;
      const since = 4200 - (this.sweepAt - now);
      if (since >= 0 && since < 1800) {
        const a = -Math.PI / 2 + (since / 1800) * TAU;
        const g = ctx.createConicGradient ? ctx.createConicGradient(a, cx, cy) : null;
        if (g) {
          g.addColorStop(0, rgba(accent, 0.16)); g.addColorStop(0.12, rgba(accent, 0)); g.addColorStop(1, rgba(accent, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, S * 0.48, 0, TAU); ctx.fill();
        }
      }
    }

    // ── outer tick ring ───────────────────────────────────────────────
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.spin * 0.05);
    ctx.strokeStyle = rgba(accent, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, S * 0.455, 0, TAU); ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const a = i * TAU / 72, long = i % 6 === 0;
      const r0 = S * (long ? 0.425 : 0.44), r1 = S * 0.455;
      ctx.strokeStyle = rgba(accent, long ? 0.8 : 0.35); ctx.lineWidth = long ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();

    // ── arc ring, counter-rotating ────────────────────────────────────
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-this.spin * 0.22);
    ctx.lineWidth = 3;
    for (const [start, len, al] of [[0, 1.25, 0.9], [1.9, 0.7, 0.55], [3.3, 1.9, 0.75], [5.7, 0.35, 0.45]]) {
      ctx.strokeStyle = rgba(accent, al);
      ctx.beginPath(); ctx.arc(0, 0, S * 0.395, start, start + len); ctx.stroke();
    }
    ctx.restore();

    // ── dashed ring + four brackets ───────────────────────────────────
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.spin * 0.11);
    ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.strokeStyle = rgba(accent, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, S * 0.335, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(accent, 0.85);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      ctx.beginPath(); ctx.arc(0, 0, S * 0.335, a - 0.16, a + 0.16); ctx.stroke();
    }
    ctx.restore();

    // ── the voice meter: 64 radial bars around the core ───────────────
    const N = 64, r0 = S * 0.215;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2);
    for (let i = 0; i < N; i++) {
      const a = i * TAU / N;
      const wave = 0.5 + 0.5 * Math.sin(t * 9 + i * 0.55) * Math.sin(t * 2.3 + i * 0.13);
      const rnd = 0.55 + 0.45 * hash(i + 700);
      const len = S * (0.012 + E * 0.075 * wave * rnd);
      ctx.strokeStyle = rgba(accent, 0.25 + E * 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); ctx.stroke();
    }
    ctx.restore();

    // ── the core: aperture blades, orb, pupil ─────────────────────────
    const R = S * 0.15 * (1 + E * 0.08 + 0.015 * Math.sin(t * 1.3));
    ctx.save(); ctx.translate(cx, cy);
    ctx.shadowColor = rgba(accent, 0.9); ctx.shadowBlur = (18 + E * 30) * faint;
    const orb = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    orb.addColorStop(0, rgba('#ffffff', 0.95));
    orb.addColorStop(0.18, rgba(accent, 0.95));
    orb.addColorStop(0.55, rgba(accent, 0.35));
    orb.addColorStop(1, rgba(accent, 0.04));
    ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // twelve blades, rotating slowly, opening with energy
    ctx.rotate(this.spin * 0.35);
    ctx.strokeStyle = rgba(accent, 0.9); ctx.lineWidth = 1.5;
    const open = 0.55 + E * 0.35;
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * open, Math.sin(a) * R * open);
      ctx.lineTo(Math.cos(a + 0.45) * R * 1.02, Math.sin(a + 0.45) * R * 1.02);
      ctx.stroke();
    }
    ctx.rotate(-this.spin * 0.35);
    // inner ring and pupil
    ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(P.light ? P.royal : '#0a0c18', 0.9);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.22 * (1 - E * 0.3), 0, TAU); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.beginPath(); ctx.arc(-R * 0.08, -R * 0.08, R * 0.06, 0, TAU); ctx.fill();
    ctx.restore();

    // ── particles ─────────────────────────────────────────────────────
    const pspeed = this.reduced ? 0 : this.state === 'thinking' ? 4 : 1;
    for (const p of this.particles) {
      p.a += p.s * dt * pspeed;
      const wobble = 1 + 0.015 * Math.sin(t * 0.7 + p.ph);
      const x = cx + Math.cos(p.a) * S * p.r * wobble, y = cy + Math.sin(p.a) * S * p.r * wobble;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.ph));
      ctx.fillStyle = rgba(accent, tw * 0.8);
      ctx.beginPath(); ctx.arc(x, y, p.z, 0, TAU); ctx.fill();
    }

    // ── listening: sonar pings from the core outward ──────────────────
    if (this.state === 'listening' && !this.reduced && now - this.lastPing > 1500) { this.pings.push(now); this.lastPing = now; }
    this.pings = this.pings.filter(p0 => now - p0 < 1700);
    for (const p0 of this.pings) {
      const q = (now - p0) / 1700;
      ctx.strokeStyle = rgba(P.gold, (1 - q) * 0.6); ctx.lineWidth = 2 - q;
      ctx.beginPath(); ctx.arc(cx, cy, S * (0.15 + q * 0.34), 0, TAU); ctx.stroke();
    }
  }
}

/* ── colour helper: hex (#rgb / #rrggbb) or rgb() → rgba() with alpha ──── */
function rgba(color, a) {
  const c = String(color).trim();
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }
  const rgb = c.match(/rgba?\(([^)]+)\)/);
  if (rgb) { const [r, g, b] = rgb[1].split(',').map(s => parseFloat(s)); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }
  return c;
}
