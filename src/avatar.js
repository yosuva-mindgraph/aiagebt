/* ============================================================================
   IRIS — the presenter.

   NOT A FACE. AN APERTURE.

   The source briefing is where the name comes from: "like an iris, AIRIS
   enables an Airport to SEE and understand its operations." So this draws the
   metaphor the product is named after, and nothing else — a level ring, two
   hairlines, and a pupil that opens and closes.

   ── why the bust went ────────────────────────────────────────────────────
   The file that was here said, correctly, that "a half-convincing photoreal
   head reads as a failure; a confident drawn one reads as a choice" — and then
   drew a flat, perfectly symmetrical mask: one ellipse head, two identical
   eyes, arc brows, a nose that met nothing, translucent hair that read as a
   swim cap. Nothing in it was asymmetric, shaded off-axis or highlighted.

   Improving that drawing is a fight it cannot win. The 3D build ships a
   photoreal GLB, so a better drawing competes with a real head on the real
   head's ground — and it does so in the DEFAULT build, which is the one most
   clients see. An aperture cannot fall into the uncanny valley, because it is
   not attempting a face. That is the whole argument.

   Literal aperture BLADES were tried first and cut: overlapping polygons read
   as a sci-fi rune, not an instrument. What is left is a dial.

   ── one number drives all of it ──────────────────────────────────────────
   setLevel() carries real RMS when ElevenLabs is present. When it is null —
   Web Speech, or no key at all, which is the common case — the envelope is
   synthesised from the viseme track, so the ring never sits dead through a
   line. Count of lit ticks, the two hairline radii, the iris radius and the
   pupil (which CONSTRICTS as the light rises, because that is what an iris
   does) are all functions of that single value.

   ── the rules this file does not get to reinterpret ──────────────────────
   COLOUR. Sky when the platform speaks, Gold when it is the human's turn,
   Peach while thinking. Held without exception across the product.

   TOKENS. tests/guards.test.mjs DERIVES the list of custom properties this file
   looks up — by parsing the getPropertyValue call sites out of this source —
   and requires each one to be literal hex in :root, in [data-theme="light"]
   AND in the prefers-color-scheme block. (Do not write an EXAMPLE lookup in a
   comment here: the parser cannot tell prose from code, and a made-up property
   name in a comment becomes a token the guard then demands the stylesheet
   define.) The reason for the hex rule is that
   _alpha() parses #rgb/#rrggbb and returns anything else unchanged, which
   silently turns every translucent layer opaque. Only four tokens satisfy that
   in all three blocks: --sky, --gold, --royal and --ink-3. --peach is
   `var(--dxc-peach)` / `var(--dxc-melon)`, an indirection rather than a
   literal, so the thinking hue is TINTED FROM --gold here instead. That
   tracks the semantic in both themes (Midnight: #FFAE41 → a peach; Canvas:
   #D14600 → a melon, which is what --peach resolves to there anyway).

   PERFORMANCE. The old file called getComputedStyle() inside the frame loop at
   60fps, and read a token it never used. Tokens are resolved on construction
   and on a theme change — never per frame.

   MOTION. prefers-reduced-motion is honoured through this.reduced: no ring
   rotation, no pulse, no easing. A real audio level still moves the ring,
   because that is information rather than decoration.

   PUBLIC SURFACE IS UNCHANGED — src/presenter.js and src/avatar3d.js depend on
   it. visemesFor() and VISEME stay exported and working even though an
   aperture has no mouth: the 3D backend consumes them.

   States: idle · speaking · listening · thinking
   ========================================================================== */

/* Viseme set — mouth width, mouth height, roundness, teeth. Small on purpose:
   beyond about eight shapes the eye stops reading individual phonemes anyway.
   The aperture draws no mouth; it reads `h` as speech openness to synthesise an
   envelope, and src/avatar3d.js still consumes the whole table. */
const VISEME = {
  rest: { w: .42, h: .05, r: .30, t: 0 },
  AA:   { w: .58, h: .40, r: .18, t: .3 },   // father, cat
  E:    { w: .66, h: .22, r: .10, t: .6 },   // bed, they
  I:    { w: .60, h: .13, r: .08, t: .7 },   // sit, meet
  O:    { w: .38, h: .38, r: .85, t: .1 },   // go, off
  U:    { w: .28, h: .26, r: .95, t: 0  },   // boot, book
  FV:   { w: .52, h: .09, r: .15, t: .9 },   // f, v
  MBP:  { w: .44, h: .01, r: .30, t: 0  },   // m, b, p — closed
  L:    { w: .54, h: .24, r: .12, t: .5 },   // l, n, d, t
  S:    { w: .56, h: .08, r: .10, t: .85 },  // s, z, sh, ch
};

const CHAR_VISEME = {
  a: 'AA', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I',
  m: 'MBP', b: 'MBP', p: 'MBP',
  f: 'FV', v: 'FV',
  s: 'S', z: 'S', c: 'S', x: 'S', j: 'S',
  l: 'L', n: 'L', d: 'L', t: 'L', r: 'L', g: 'L', k: 'L', h: 'L', w: 'U', q: 'U',
};

/** Turn a line of narration into a viseme track. */
export function visemesFor(text) {
  const out = [];
  const lower = (text || '').toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (ch === ' ' || ch === '\n') { out.push('rest'); continue; }
    if (!/[a-z]/.test(ch)) continue;
    // digraphs the single-char map would get wrong
    const two = lower.slice(i, i + 2);
    if (two === 'sh' || two === 'ch') { out.push('S'); i++; continue; }
    if (two === 'th') { out.push('L'); i++; continue; }
    if (two === 'oo') { out.push('U'); i++; continue; }
    if (two === 'ee') { out.push('I'); i++; continue; }
    out.push(CHAR_VISEME[ch] || 'L');
  }
  return out.length ? out : ['rest'];
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const TAU = Math.PI * 2;

/* 36 ticks: 10° apart. Enough that the lit run reads as a continuous arc at a
   glance and still resolves as individual marks at rail width; few enough that
   one tick is a legible 1/36th step of the level. */
const TICKS = 36;

/* The widest openness in the viseme table, so the synthesised envelope is
   normalised against the data rather than against a magic number. */
const MAX_OPEN = Math.max(...Object.values(VISEME).map(v => v.h));

/* MediaQueryList listeners, tolerating the pre-2021 Safari shape. */
const mqOn = (mq, fn) => {
  try { mq.addEventListener('change', fn); } catch { try { mq.addListener(fn); } catch { /* fixed query */ } }
};
const mqOff = (mq, fn) => {
  try { mq.removeEventListener('change', fn); } catch { try { mq.removeListener(fn); } catch { /* fixed query */ } }
};

export class Avatar {
  constructor(canvas, { name = 'IRIS' } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.name = name;
    this.state = 'idle';
    this.track = ['rest'];
    this.trackStart = 0;
    this.trackDur = 0;
    this.level = null;          // external RMS 0..1, when real audio drives it

    this.amp = 0;               // the smoothed drive — every radius comes off this
    this.t0 = performance.now();
    this.raf = null;

    this._mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this._mqMotion.matches;

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    this._retheme = this._readTokens.bind(this);
    this._remotion = () => { this.reduced = this._mqMotion.matches; };

    this._readTokens();

    /* A theme change is an EVENT, not a per-frame question. app.js sets
       data-theme on the document element; the media query covers the viewer who
       never touches the toggle. Both are cheap, and both are torn down in
       destroy().

       (No literal markup tag in a comment in this file, ever: build.js inlines
       this source verbatim into dist/artifact.html, and the build suite asserts
       that file carries no document scaffolding. A tag written in prose here is
       indistinguishable from one written in anger — it cost a red gate once.) */
    this._mqLight = matchMedia('(prefers-color-scheme: light)');
    mqOn(this._mqLight, this._retheme);
    mqOn(this._mqMotion, this._remotion);
    try {
      this._obs = new MutationObserver(this._retheme);
      this._obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch { this._obs = null; }

    addEventListener('resize', this._resize);
    this._resize();
    this.raf = requestAnimationFrame(this._frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this._resize);
    if (this._obs) this._obs.disconnect();
    mqOff(this._mqLight, this._retheme);
    mqOff(this._mqMotion, this._remotion);
  }

  setState(s) { this.state = s; }

  /** Start lip-syncing `text` over `durationMs`. */
  speak(text, durationMs) {
    this.track = visemesFor(text);
    this.trackStart = performance.now();
    this.trackDur = Math.max(400, durationMs || this.track.length * 62);
    this.state = 'speaking';
  }

  stopSpeaking() { this.track = ['rest']; this.trackDur = 0; this.level = null; if (this.state === 'speaking') this.state = 'idle'; }

  /** Optional: drive the ring from real audio RMS (0..1). */
  setLevel(v) { this.level = v; }

  /* ── the palette, resolved once ──────────────────────────────────────────
     Four literal-hex tokens, read with literal names: guards.test.mjs parses
     THESE CALL SITES out of the source to build the list it enforces, so a
     lookup through a variable would derive an empty list and quietly disarm
     the guard. Keep them spelled out. */
  _readTokens() {
    const css = getComputedStyle(document.documentElement);
    this.SKY   = (css.getPropertyValue('--sky')   || '').trim() || '#A1E6FF';
    this.GOLD  = (css.getPropertyValue('--gold')  || '').trim() || '#FFAE41';
    this.ROYAL = (css.getPropertyValue('--royal') || '').trim() || '#004AAC';
    this.INK3  = (css.getPropertyValue('--ink-3') || '').trim() || '#8B8B90';

    /* Is the platform's voice LIGHTER than the surface it sits on? On Midnight
       --sky is near-white; on Canvas it is Royal. One measurement, and it tells
       every compositing decision below which way "brighter" points — no second
       token, no user-agent sniffing, and it follows a rebrand automatically. */
    this.onDark = this._lum(this.SKY) > .45;

    /* Peach, derived — see the header on why it cannot be read as a token.

       Two different amounts because the two themes have different problems.
       On Midnight, Gold is #FFAE41 and a third of the way to white is a clear
       peach. On Canvas, Gold is DXC Red (#D14600) and --peach resolves to Melon
       (#FF7E51) — a visibly lighter, warmer thing — so too small a tint leaves
       thinking and listening the same colour and the semantic stops being
       expressed at all. .26 lands near Melon while keeping the mark solid
       enough to read on paper, which the ring and the disc both have to do. */
    this.PEACH = this._tint(this.GOLD, this.onDark ? .34 : .26);

    // Unlit ticks need more weight on paper than on Midnight to read at all.
    this.dimA = this.onDark ? .30 : .46;
  }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, Math.round(r.width * dpr));
    this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
  }

  /* ── THE ONE NUMBER ──────────────────────────────────────────────────────
     Everything the aperture does is a function of this. Real RMS wins whenever
     it is there; otherwise the viseme track supplies the timing. */
  _drive(now) {
    if (this.state === 'speaking') {
      if (this.level != null) return clamp01(this.level * 2.4);
      return this._synth(now);
    }
    if (this.state === 'listening') return this.reduced ? .46 : .46 + Math.sin(now / 900) * .10;
    if (this.state === 'thinking')  return this.reduced ? .26 : .26 + Math.sin(now / 520) * .07;
    return this.reduced ? .07 : .07 + Math.sin(now / 1500) * .025;
  }

  /**
   * A plausible speech envelope with no audio to measure.
   *
   * The viseme track already carries the timing of the line — it is advanced on
   * a clock matched to the measured duration of the utterance — so openness is
   * interpolated BETWEEN consecutive visemes (a stepped read is what makes a
   * fake meter look like a fake meter), then swelled at roughly syllable rate
   * and grained so it is never metronomic.
   */
  _synth(now) {
    const el = now - this.trackStart;
    if (this.trackDur <= 0 || el > this.trackDur) return .10;
    const n = this.track.length;
    const x = el / this.trackDur * n;
    const i = Math.min(n - 1, Math.max(0, Math.floor(x)));
    const a = VISEME[this.track[i]] || VISEME.rest;
    const b = VISEME[this.track[Math.min(n - 1, i + 1)]] || VISEME.rest;
    const open = lerp(a.h, b.h, x - i) / MAX_OPEN;
    if (this.reduced) return .55;                       // no time terms at all
    const swell = .80 + Math.sin(el / 121) * .20;
    const grain = 1 + Math.sin(el / 37) * .10;
    return clamp01((.22 + open * .78) * swell * grain);
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const ctx = this.ctx, W = this.c.width, H = this.c.height;
    const t = (now - this.t0) / 1000;

    /* Fast attack, slow release — a meter that snaps up and falls away reads as
       measuring something. Reduced motion takes the target directly: no easing. */
    const tgt = this._drive(now);
    this.amp = this.reduced ? tgt : lerp(this.amp, tgt, tgt > this.amp ? .40 : .14);
    const amp = this.amp;

    const listening = this.state === 'listening';
    const thinking = this.state === 'thinking';
    const hue = listening ? this.GOLD : thinking ? this.PEACH : this.SKY;
    const dark = this.onDark;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // unit space: 0..1 on the short side, centred
    const S = Math.min(W, H);
    ctx.translate((W - S) / 2, (H - S) / 2);
    ctx.scale(S, S);

    const cx = .5, cy = .5, R = .42;
    /* The dial rocks a couple of degrees; it never spins. The lit run has to
       start at twelve o'clock in every state or it stops being a reading. */
    const rot = this.reduced ? 0 : Math.sin(t * .24) * .045;
    /* Thinking is the one state a level alone cannot express — a 26% ring is a
       quiet idle with a different hue. So it gets a scanner: one bright mark
       travelling the housing, which the level run underneath is unaffected by.
       -1 disables it, and reduced motion never lights it. */
    const sweep = (thinking && !this.reduced) ? (t * .30) % 1 : -1;

    /* ── ground glow ─────────────────────────────────────────────────────
       Focus deliberately off-centre: the one thing the old bust never had was
       a light source anywhere but dead ahead.

       Royal is the depth behind the accent on Midnight. On Canvas it has to be
       almost nothing: --royal and --sky are the SAME value in the light theme,
       so any weight here stops reading as depth and starts reading as a blue
       stain spreading under a red aperture. */
    const lit = .34 + amp * .66;
    const a0 = (dark ? .30 : .13) * lit;
    const glow = ctx.createRadialGradient(cx - .035, cy - .048, .02, cx, cy, R * 1.32);
    glow.addColorStop(0,   this._alpha(hue, a0));
    glow.addColorStop(.36, this._alpha(hue, a0 * .46));
    glow.addColorStop(.70, this._alpha(this.ROYAL, dark ? .11 : .022));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1, 1);

    /* ── the level ring ──────────────────────────────────────────────────
       36 ticks. The housing tick is always drawn, so at rest it is still a
       dial; the lit tick crossfades in over it and grows INWARD, which is what
       makes a filling run read as gaining energy rather than just gaining
       length. The run is spread over ~2.6 ticks at its leading edge so the
       level has no cliff in it. */
    const run = amp * TICKS;
    ctx.lineCap = 'round';
    for (let i = 0; i < TICKS; i++) {
      const f = clamp01((run - i) / 2.6);
      // the scanner: signed circular distance from the travelling head, lighting
      // a short tail BEHIND it only, so thinking reads as working rather than
      // as a low idle in a different hue
      let g = 0;
      if (sweep >= 0) {
        const d = ((i / TICKS) - sweep + 1.5) % 1 - .5;
        g = d > 0 ? 0 : Math.max(0, 1 + d * 7);
      }
      const w = f > g ? f : g;
      const a = -Math.PI / 2 + rot + (i / TICKS) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);

      const hIn = R * .880, hOut = R * .975;
      ctx.beginPath();
      ctx.moveTo(cx + ca * hIn, cy + sa * hIn);
      ctx.lineTo(cx + ca * hOut, cy + sa * hOut);
      ctx.strokeStyle = this._alpha(this.INK3, this.dimA * (1 - w * .8));
      ctx.lineWidth = .0070;
      ctx.stroke();

      if (w <= .012) continue;
      const rIn = R * (.880 - .130 * w), rOut = R * (.975 + .025 * w);
      const x0 = cx + ca * rIn, y0 = cy + sa * rIn;
      const x1 = cx + ca * rOut, y1 = cy + sa * rOut;
      // bloom, then the mark. A wide low-alpha pass rather than shadowBlur,
      // which is not reliably scaled by the transform across engines.
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = this._alpha(hue, (dark ? .17 : .12) * w);
      ctx.lineWidth = .0200; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = this._alpha(hue, ((dark ? .42 : .50) + .52 * w) * (f > g ? 1 : .80));
      ctx.lineWidth = .0086; ctx.stroke();
    }

    /* ── two concentric hairlines, breathing with the level ─────────────── */
    const h1 = R * (.545 + amp * .055);
    const h2 = R * (.330 + amp * .045);
    ctx.lineWidth = .0030;
    ctx.strokeStyle = this._alpha(hue, dark ? .38 : .34);
    ctx.beginPath(); ctx.arc(cx, cy, h1, 0, TAU); ctx.stroke();
    ctx.strokeStyle = this._alpha(hue, dark ? .54 : .48);
    ctx.beginPath(); ctx.arc(cx, cy, h2, 0, TAU); ctx.stroke();

    // the sheen: one off-axis highlight on the outer hairline, upper-left, so
    // the ring is lit from somewhere rather than uniformly self-illuminated
    ctx.strokeStyle = this._alpha(hue, dark ? .72 : .62);
    ctx.lineWidth = .0036;
    ctx.beginPath(); ctx.arc(cx, cy, h1, Math.PI * 1.06, Math.PI * 1.44); ctx.stroke();

    /* ── the iris ────────────────────────────────────────────────────────
       Nearly FLAT. An off-centre gradient with any range in it turns this into
       a shaded sphere, and a shaded sphere with a bright pupil-hole in it reads
       as a marble with a catchlight — which is a worse thing to be than a face.
       The off-axis light lives in the ring sheen and the glow instead; this
       keeps only enough falloff to seat the disc against them. */
    const ir = R * (.245 + amp * .075);
    const disc = ctx.createRadialGradient(cx - ir * .22, cy - ir * .24, ir * .10, cx, cy, ir);
    disc.addColorStop(0,   this._alpha(hue, 1));
    disc.addColorStop(.74, this._alpha(hue, .97));
    disc.addColorStop(1,   this._alpha(hue, .88));
    ctx.beginPath(); ctx.arc(cx, cy, ir, 0, TAU);
    ctx.fillStyle = disc; ctx.fill();
    ctx.strokeStyle = this._alpha(hue, .95); ctx.lineWidth = .0026; ctx.stroke();

    /* ── the pupil, which is an actual hole ──────────────────────────────
       destination-out rather than a dark fill: the page shows through, so it is
       right on Midnight AND on Canvas with no colour decision to get wrong, and
       it is what an aperture literally is. It CONSTRICTS as the light rises —
       the second channel for the same one number.

       Cut HARD, with only a hairline of feather. A soft hole is a smudge; a
       hard one is an opening. */
    const pr = ir * (.38 - amp * .11);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(cx, cy, pr * .88, cx, cy, pr);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill();
    ctx.restore();

    // the aperture's inner edge, so the hole reads as cut rather than smudged
    ctx.strokeStyle = this._alpha(hue, dark ? .55 : .70); ctx.lineWidth = .0022;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.stroke();

    /* ── listening: one outward ping, because "your turn" is an invitation ── */
    if (listening && !this.reduced) {
      const p = (t * .62) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, h1 + p * (R - h1) * 1.05, 0, TAU);
      ctx.strokeStyle = this._alpha(hue, (1 - p) * .34);
      ctx.lineWidth = .0030; ctx.stroke();
    }

    ctx.restore();
  }

  /* ── colour helpers ──────────────────────────────────────────────────────
     _alpha() is the one the build leans on: hand it anything it cannot take
     apart and it returns the string unchanged, so the alpha is silently
     dropped and a translucent layer renders opaque. It now also reads #rgba,
     #rrggbbaa and rgb()/rgba() — but the guard's hex requirement on the four
     tokens is still what makes that safe, because a color-mix() or an oklch()
     would fall straight through here. */
  _alpha(color, a) {
    const c = (color || '').trim();
    if (c[0] === '#') {
      const n = c.length - 1;
      let r, g, b, e = 1;
      if (n === 3 || n === 4) {
        r = parseInt(c[1] + c[1], 16); g = parseInt(c[2] + c[2], 16); b = parseInt(c[3] + c[3], 16);
        if (n === 4) e = parseInt(c[4] + c[4], 16) / 255;
      } else if (n === 6 || n === 8) {
        r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16);
        if (n === 8) e = parseInt(c.slice(7, 9), 16) / 255;
      } else return c;
      if (!(r >= 0 && g >= 0 && b >= 0)) return c;      // NaN — not hex after all
      return `rgba(${r},${g},${b},${a * e})`;
    }
    const m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      if (p.length >= 3 && p.slice(0, 3).every(v => v >= 0)) {
        const e = p.length > 3 && p[3] >= 0 ? p[3] : 1;
        return `rgba(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])},${a * e})`;
      }
    }
    return c;
  }

  /** Mix a hex colour toward white by t — how the thinking peach is made. */
  _tint(hex, t) {
    const c = (hex || '').trim();
    if (c[0] !== '#') return c;
    const n = c.length - 1;
    let r, g, b;
    if (n === 3 || n === 4) {
      r = parseInt(c[1] + c[1], 16); g = parseInt(c[2] + c[2], 16); b = parseInt(c[3] + c[3], 16);
    } else if (n === 6 || n === 8) {
      r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16);
    } else return c;
    if (!(r >= 0 && g >= 0 && b >= 0)) return c;
    const up = v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
    return `#${up(r)}${up(g)}${up(b)}`;
  }

  /** Perceptual-ish luminance 0..1, reusing _alpha() as the parser. */
  _lum(hex) {
    const p = /rgba?\(([\d.]+),([\d.]+),([\d.]+)/.exec(this._alpha(hex, 1));
    if (!p) return 1;
    return (+p[1] * .299 + +p[2] * .587 + +p[3] * .114) / 255;
  }
}
