/* ============================================================================
   AIRIS — the presenter.

   A canvas bust, drawn rather than filmed. The name is not decoration: the
   source briefing says "like an iris, AIRIS enables an airport to SEE and
   understand its operations", so the eye is the thing this face is built
   around and everything else is quieter than it.

   Deliberately stylised. A half-convincing photoreal head reads as a failure;
   a confident drawn one reads as a choice. It is lit sky when the platform is
   speaking and gold when it is the human's turn — the same rule the rest of
   the page holds to.

   States: idle · speaking · listening · thinking
   Lip-sync: visemes derived from the text being spoken, advanced on a clock
   that matches the measured duration of the utterance, with an amplitude
   jitter on top so it never looks metronomic. When a real audio buffer is
   available (ElevenLabs), setLevel() drives the jaw from actual RMS instead.
   ========================================================================== */

/* Viseme set — mouth width, mouth height, roundness, teeth. Small on purpose:
   beyond about eight shapes the eye stops reading individual phonemes anyway. */
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

    this.cur = { ...VISEME.rest };
    this.blink = 0;
    this.nextBlink = 900;
    this.t0 = performance.now();
    this.raf = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    addEventListener('resize', this._resize);
    this._resize();
    this.raf = requestAnimationFrame(this._frame);
  }

  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this._resize); }

  setState(s) { this.state = s; }

  /** Start lip-syncing `text` over `durationMs`. */
  speak(text, durationMs) {
    this.track = visemesFor(text);
    this.trackStart = performance.now();
    this.trackDur = Math.max(400, durationMs || this.track.length * 62);
    this.state = 'speaking';
  }

  stopSpeaking() { this.track = ['rest']; this.trackDur = 0; this.level = null; if (this.state === 'speaking') this.state = 'idle'; }

  /** Optional: drive the jaw from real audio RMS (0..1). */
  setLevel(v) { this.level = v; }

  _resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, Math.round(r.width * dpr));
    this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
  }

  _target() {
    if (this.state !== 'speaking') return VISEME.rest;
    if (this.level != null) {
      // real audio: blend rest → open by amplitude
      const a = Math.min(1, this.level * 2.2);
      return { w: lerp(.42, .60, a), h: lerp(.04, .40, a), r: lerp(.30, .20, a), t: a * .5 };
    }
    const el = performance.now() - this.trackStart;
    if (el > this.trackDur) return VISEME.rest;
    const i = Math.min(this.track.length - 1, Math.floor(el / this.trackDur * this.track.length));
    const v = VISEME[this.track[i]] || VISEME.rest;
    // a little life so it is never metronomic
    const j = 1 + Math.sin(el / 47) * .10;
    return { w: v.w, h: v.h * j, r: v.r, t: v.t };
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const ctx = this.ctx, W = this.c.width, H = this.c.height;
    const t = (now - this.t0) / 1000;

    // ease toward the target mouth
    const tgt = this._target();
    const k = this.reduced ? 1 : .34;
    for (const key of ['w', 'h', 'r', 't']) this.cur[key] = lerp(this.cur[key], tgt[key], k);

    // blink clock
    if (!this.reduced) {
      if (now - this.t0 > this.nextBlink) {
        this.blink = 1;
        this.nextBlink = now - this.t0 + 2200 + Math.random() * 3600;
      }
      this.blink = Math.max(0, this.blink - .16);
    }

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // unit space: 0..1 on the short side, centred
    const S = Math.min(W, H);
    ctx.translate((W - S) / 2, (H - S) / 2);
    ctx.scale(S, S);

    const speaking = this.state === 'speaking';
    const listening = this.state === 'listening';
    const thinking = this.state === 'thinking';

    const css = getComputedStyle(document.documentElement);
    const SKY = css.getPropertyValue('--sky').trim() || '#a1e6ff';
    const GOLD = css.getPropertyValue('--gold').trim() || '#ffae41';
    const ROYAL = css.getPropertyValue('--royal').trim() || '#004aac';
    const INK3 = css.getPropertyValue('--ink-3').trim() || '#7b82a6';
    const hue = listening ? GOLD : SKY;

    // Frame it like a portrait, not a diagram: the head fills the panel and
    // the shoulders run off the bottom corners. Everything below is authored
    // in a comfortable 0..1 space and then cropped in by this one transform.
    const ZOOM = 1.34;
    ctx.translate(.5, .50); ctx.scale(ZOOM, ZOOM); ctx.translate(-.5, -.5);

    // idle sway — small, so it reads as alive rather than animated
    const sway = this.reduced ? 0 : Math.sin(t * .62) * .006 + (speaking ? Math.sin(t * 3.1) * .0022 : 0);
    const bob = this.reduced ? 0 : Math.sin(t * .48) * .005;
    ctx.translate(sway, bob);

    /* ── volumetric ground glow ─────────────────────────────────────── */
    const glow = ctx.createRadialGradient(.5, .46, .04, .5, .46, .48);
    glow.addColorStop(0, this._alpha(hue, speaking ? .26 : .16));
    glow.addColorStop(.55, this._alpha(ROYAL, .14));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1, 1);

    /* ── shoulders ──────────────────────────────────────────────────────
       Deliberately wider than the frame and flat across the top: a dome
       reads as a pedestal, shoulders read as a person. The trapezius line
       leaves frame at the sides rather than curving back in.             */
    ctx.beginPath();
    ctx.moveTo(-.10, 1.05);
    ctx.bezierCurveTo(-.02, .800, .19, .712, .375, .690);
    ctx.lineTo(.625, .690);
    ctx.bezierCurveTo(.81, .712, 1.02, .800, 1.10, 1.05);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, .68, 0, 1.05);
    sg.addColorStop(0, this._alpha(hue, .30));
    sg.addColorStop(.5, this._alpha(ROYAL, .22));
    sg.addColorStop(1, this._alpha(ROYAL, .06));
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = this._alpha(hue, .42); ctx.lineWidth = .0034; ctx.stroke();

    // collar — one line, but it is what stops the bust reading as a blob
    ctx.beginPath();
    ctx.moveTo(.370, .692);
    ctx.quadraticCurveTo(.5, .790, .630, .692);
    ctx.strokeStyle = this._alpha(hue, .50); ctx.lineWidth = .0030; ctx.stroke();

    /* ── neck ──────────────────────────────────────────────────────────
       The junction is where a drawn bust usually falls apart: a flat slab
       between two lit shapes reads as pasted on. So it is a gradient that
       starts at the jaw and dissolves into the shoulder, with the sides
       shaded rather than outlined.                                        */
    const ng = ctx.createLinearGradient(0, .560, 0, .760);
    ng.addColorStop(0, this._alpha('#05070f', .55));
    ng.addColorStop(.45, this._alpha(hue, .18));
    ng.addColorStop(1, this._alpha(hue, .015));
    ctx.beginPath();
    ctx.moveTo(.450, .560);
    ctx.bezierCurveTo(.444, .660, .430, .700, .414, .760);
    ctx.lineTo(.586, .760);
    ctx.bezierCurveTo(.570, .700, .556, .660, .550, .560);
    ctx.closePath();
    ctx.fillStyle = ng; ctx.fill();

    // sterno line — one asymmetric mark stops the neck reading as a tube
    ctx.beginPath();
    ctx.moveTo(.470, .600); ctx.quadraticCurveTo(.484, .672, .506, .722);
    ctx.strokeStyle = this._alpha(hue, .20); ctx.lineWidth = .0022; ctx.stroke();

    /* ── head ───────────────────────────────────────────────────────── */
    const cx = .5, cy = .385, rx = .150, ry = .215;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    // temple → cheekbone → jaw → chin, and back. The jaw is narrow and the
    // chin short; a wide jaw is what makes a drawn face read as a mask.
    ctx.bezierCurveTo(cx + rx * .98, cy - ry * .92, cx + rx * 1.02, cy + ry * .22, cx + rx * .78, cy + ry * .58);
    ctx.bezierCurveTo(cx + rx * .56, cy + ry * .93, cx + rx * .26, cy + ry * 1.04, cx, cy + ry * 1.04);
    ctx.bezierCurveTo(cx - rx * .26, cy + ry * 1.04, cx - rx * .56, cy + ry * .93, cx - rx * .78, cy + ry * .58);
    ctx.bezierCurveTo(cx - rx * 1.02, cy + ry * .22, cx - rx * .98, cy - ry * .92, cx, cy - ry);
    ctx.closePath();
    const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    hg.addColorStop(0, this._alpha(hue, .30));
    hg.addColorStop(.52, this._alpha(ROYAL, .20));
    hg.addColorStop(1, this._alpha(hue, .10));
    ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = this._alpha(hue, .62); ctx.lineWidth = .004; ctx.stroke();

    // rim light, left — the light source is the console in front of her
    ctx.save(); ctx.clip();
    const rim = ctx.createLinearGradient(cx - rx, 0, cx - rx * .1, 0);
    rim.addColorStop(0, this._alpha(hue, .50));
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rim; ctx.fillRect(0, 0, 1, 1);

    // scanlines — the reason the stylisation reads as deliberate
    if (!this.reduced) {
      ctx.globalAlpha = .13;
      ctx.strokeStyle = hue; ctx.lineWidth = .0016;
      const off = (t * .012) % .012;
      for (let y = cy - ry - off; y < cy + ry; y += .012) {
        ctx.beginPath(); ctx.moveTo(cx - rx, y); ctx.lineTo(cx + rx, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* ── hair ───────────────────────────────────────────────────────────
       Swept, not a cap band. The asymmetry is the whole job: a symmetrical
       arc across the crown reads as a bald cap however it is shaded.     */
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.06, cy + ry * .12);
    ctx.bezierCurveTo(cx - rx * 1.10, cy - ry * .95, cx - rx * .30, cy - ry * 1.22, cx + rx * .42, cy - ry * 1.06);
    ctx.bezierCurveTo(cx + rx * 1.02, cy - ry * .92, cx + rx * 1.10, cy - ry * .10, cx + rx * 1.02, cy + ry * .16);
    // the hairline, swept across the brow from the right part
    ctx.bezierCurveTo(cx + rx * .88, cy - ry * .48, cx + rx * .30, cy - ry * .60, cx - rx * .18, cy - ry * .50);
    ctx.bezierCurveTo(cx - rx * .62, cy - ry * .42, cx - rx * .90, cy - ry * .20, cx - rx * 1.06, cy + ry * .12);
    ctx.closePath();
    const hair = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy);
    hair.addColorStop(0, this._alpha(hue, .50));
    hair.addColorStop(.55, this._alpha(ROYAL, .46));
    hair.addColorStop(1, this._alpha(hue, .30));
    ctx.fillStyle = hair; ctx.fill();
    ctx.strokeStyle = this._alpha(hue, .40); ctx.lineWidth = .0026; ctx.stroke();

    /* ── brows ──────────────────────────────────────────────────────── */
    const browLift = speaking ? Math.sin(t * 1.9) * .006 : (thinking ? .010 : 0);
    ctx.strokeStyle = this._alpha(hue, .66); ctx.lineWidth = .0048; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = cx + s * .058;
      ctx.beginPath();
      ctx.moveTo(ex - s * .038, cy - .050 - browLift + (thinking && s < 0 ? -.007 : 0));
      ctx.quadraticCurveTo(ex, cy - .062 - browLift, ex + s * .036, cy - .049 - browLift);
      ctx.stroke();
    }

    /* ── eyes — the iris is the point of the whole design ───────────── */
    const open = 1 - Math.min(1, this.blink);
    for (const s of [-1, 1]) {
      const ex = cx + s * .058, ey = cy - .008;
      const ew = .040, eh = .0195 * open;

      // socket
      ctx.beginPath(); ctx.ellipse(ex, ey, ew, .022, 0, 0, Math.PI * 2);
      ctx.fillStyle = this._alpha(ROYAL, .34); ctx.fill();

      if (eh > .002) {
        ctx.save();
        ctx.beginPath(); ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = this._alpha('#dff2ff', .07); ctx.fillRect(0, 0, 1, 1);

        // gaze — slightly toward the viewer, drifting when thinking
        const gx = thinking ? Math.sin(t * .7) * .012 : Math.sin(t * .33) * .004;
        const gy = thinking ? -.006 : Math.cos(t * .29) * .002;

        // iris rings
        const ir = listening ? .0182 : .0168;
        const ig = ctx.createRadialGradient(ex + gx, ey + gy, .001, ex + gx, ey + gy, ir);
        ig.addColorStop(0, this._alpha('#ffffff', .95));
        ig.addColorStop(.30, hue);
        ig.addColorStop(1, this._alpha(ROYAL, .95));
        ctx.beginPath(); ctx.arc(ex + gx, ey + gy, ir, 0, Math.PI * 2);
        ctx.fillStyle = ig; ctx.fill();

        // the aperture — concentric, because that is what an iris is
        ctx.strokeStyle = this._alpha('#0a0c18', .55); ctx.lineWidth = .0014;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath(); ctx.arc(ex + gx, ey + gy, ir * (k / 4.2), 0, Math.PI * 2); ctx.stroke();
        }
        // pupil
        ctx.beginPath(); ctx.arc(ex + gx, ey + gy, ir * .40, 0, Math.PI * 2);
        ctx.fillStyle = '#05070f'; ctx.fill();
        // catchlight
        ctx.beginPath(); ctx.arc(ex + gx - .005, ey + gy - .005, .0035, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
        ctx.restore();
      }

      // lid line
      ctx.beginPath(); ctx.ellipse(ex, ey, ew, Math.max(.002, eh), 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = this._alpha(hue, .70); ctx.lineWidth = .0032; ctx.stroke();
    }

    /* ── nose ───────────────────────────────────────────────────────── */
    ctx.beginPath();
    ctx.moveTo(cx - .004, cy + .010);
    ctx.quadraticCurveTo(cx - .018, cy + .062, cx + .002, cy + .072);
    ctx.strokeStyle = this._alpha(hue, .42); ctx.lineWidth = .0032; ctx.stroke();

    /* ── mouth ──────────────────────────────────────────────────────── */
    const m = this.cur;
    const mx = cx, my = cy + .134;
    const mw = m.w * .115, mh = Math.max(.002, m.h * .075);

    // upper lip — drawn even when the mouth is shut, so the face still has a
    // mouth at rest rather than a gap where one should be
    ctx.beginPath();
    ctx.moveTo(mx - mw * 1.10, my - .001);
    ctx.quadraticCurveTo(mx - mw * .45, my - .010, mx, my - .004);
    ctx.quadraticCurveTo(mx + mw * .45, my - .010, mx + mw * 1.10, my - .001);
    ctx.strokeStyle = this._alpha(hue, .62); ctx.lineWidth = .0030; ctx.lineCap = 'round';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    ctx.quadraticCurveTo(mx, my - mh * (1 - m.r * .55), mx + mw, my);
    ctx.quadraticCurveTo(mx, my + mh * (1 + m.r * .35), mx - mw, my);
    ctx.closePath();
    const mg = ctx.createLinearGradient(0, my - mh, 0, my + mh);
    mg.addColorStop(0, this._alpha('#1b0d12', .95));
    mg.addColorStop(1, this._alpha('#3a1420', .85));
    ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = this._alpha(hue, .78); ctx.lineWidth = .0032; ctx.stroke();

    // teeth, when the shape calls for them
    if (m.t > .18 && mh > .008) {
      ctx.clip();
      ctx.fillStyle = this._alpha('#e8f6ff', .60 * m.t);
      ctx.fillRect(mx - mw, my - mh * .95, mw * 2, mh * .55);
    }
    ctx.restore();

    // lower lip catch-light — reads the jaw opening at a glance
    ctx.beginPath();
    ctx.moveTo(mx - mw * .82, my + mh * (1 + m.r * .35) * .62);
    ctx.quadraticCurveTo(mx, my + mh * (1 + m.r * .35) + .010, mx + mw * .82, my + mh * (1 + m.r * .35) * .62);
    ctx.strokeStyle = this._alpha(hue, .34); ctx.lineWidth = .0024; ctx.stroke();

    /* ── listening ring ─────────────────────────────────────────────── */
    if (listening && !this.reduced) {
      const p = (t * .8) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, .30 + p * .16, 0, Math.PI * 2);
      ctx.strokeStyle = this._alpha(GOLD, (1 - p) * .40);
      ctx.lineWidth = .0035; ctx.stroke();
    }

    /* ── thinking: a slow arc, not three bouncing dots ──────────────── */
    if (thinking && !this.reduced) {
      const a0 = t * 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, .285, a0, a0 + 1.05);
      ctx.strokeStyle = this._alpha(hue, .70); ctx.lineWidth = .0045; ctx.lineCap = 'round'; ctx.stroke();
    }

    /* ── speaking: waveform under the bust ──────────────────────────── */
    if (speaking && !this.reduced) {
      ctx.beginPath();
      const n = 44, y0 = .905;
      for (let i = 0; i <= n; i++) {
        const x = .20 + (i / n) * .60;
        const env = Math.sin((i / n) * Math.PI);
        const amp = (this.level != null ? this.level : (.35 + this.cur.h * 1.5));
        const y = y0 + Math.sin(i * .62 + t * 11) * .020 * env * amp;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = this._alpha(hue, .55); ctx.lineWidth = .0028; ctx.stroke();
    }

    ctx.restore();
  }

  _alpha(color, a) {
    const c = (color || '').trim();
    if (c.startsWith('#')) {
      const h = c.length === 4
        ? c.slice(1).split('').map(x => parseInt(x + x, 16))
        : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
      return `rgba(${h[0]},${h[1]},${h[2]},${a})`;
    }
    return c;
  }
}
