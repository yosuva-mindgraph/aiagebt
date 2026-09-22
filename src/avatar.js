/* ============================================================================
   AIRIS — the presenter.

   Not a face and not an orb: a neural network. A sphere of glowing nodes,
   each wired to its nearest neighbours, turning slowly in space, with signals
   firing along the connections. A signal that arrives at a node lights it
   and may fire onward, so activity spreads through the mesh the way thought
   looks in a film AI's interface.

   Activity follows the voice: quiet breathing while it waits, a storm of
   firing while it speaks (from real audio RMS when ElevenLabs is playing, or
   from the text's visemes otherwise), gold signals drawn inward while it
   listens to the visitor, and a fast peach-coloured churn while it thinks.

   Colours come from the brand tokens each second, so the theme toggle holds:
   sky is the platform's, gold is the human's. Same rule as the rest of the page.

   Public surface (keep it — app.js and any future swap rely on it):
     setState(s) · speak(text, durationMs) · stopSpeaking() · setLevel(rms)
   ========================================================================== */

/* Viseme energy, for the text-driven activity track. Open vowels carry the
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

/* a cheap, stable pseudo-random per index — the mesh must not re-roll every frame */
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const NODES = 118;          // enough to read as a network, few enough to stay crisp at 340 px
const LINKS_PER_NODE = 3;   // nearest neighbours each node is wired to
const MAX_PULSES = 140;

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

    this.energy = 0;            // eased 0..1 — activity level
    this.ry = 0; this.rx = 0.3; // rotation
    this.spawnAcc = 0;
    this.pulses = [];
    this._buildMesh();

    this.colors = null;
    this.colorsAt = 0;
    this.t0 = performance.now();
    this._last = 0;
    this.raf = null;
    this.reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    addEventListener('resize', this._resize);
    this._resize();
    this.raf = requestAnimationFrame(this._frame);
  }

  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this._resize); }

  setState(s) { this.state = s; }

  /** Start "speaking" `text` over `durationMs` — the firing follows the text. */
  speak(text, durationMs) {
    this.track = visemesFor(text);
    this.trackStart = performance.now();
    this.trackDur = Math.max(400, durationMs || this.track.length * 62);
    this.state = 'speaking';
  }

  stopSpeaking() { this.track = ['rest']; this.trackDur = 0; this.level = null; if (this.state === 'speaking') this.state = 'idle'; }

  /** Optional: drive the activity from real audio RMS (0..1). */
  setLevel(v) { this.level = v; }

  /* ── the mesh ─────────────────────────────────────────────────────── */

  _buildMesh() {
    // Two shells of points on a sphere (fibonacci spiral, jittered): an outer
    // cortex and a sparser inner core, so the network has depth.
    const nodes = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODES; i++) {
      const y = 1 - (i / (NODES - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * golden;
      const shell = i % 5 === 0 ? 0.55 + hash(i + 900) * 0.15 : 0.92 + hash(i + 901) * 0.12;
      nodes.push({
        x: Math.cos(phi) * r * shell + (hash(i) - 0.5) * 0.08,
        y: y * shell + (hash(i + 1) - 0.5) * 0.08,
        z: Math.sin(phi) * r * shell + (hash(i + 2) - 0.5) * 0.08,
        hub: hash(i + 300) > 0.86,
        fire: 0,
        links: [],
        px: 0, py: 0, s: 1, d: 0.5,
      });
    }
    // wire each node to its nearest neighbours (in the unrotated frame — rotation is rigid)
    const edges = [];
    const seen = new Set();
    for (let a = 0; a < nodes.length; a++) {
      const near = nodes.map((n, b) => ({ b, d: b === a ? Infinity : (n.x - nodes[a].x) ** 2 + (n.y - nodes[a].y) ** 2 + (n.z - nodes[a].z) ** 2 }))
        .sort((p, q) => p.d - q.d).slice(0, LINKS_PER_NODE);
      for (const { b } of near) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const e = edges.length;
        edges.push({ a, b });
        nodes[a].links.push(e); nodes[b].links.push(e);
      }
    }
    this.nodes = nodes; this.edges = edges;
  }

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
    this.colors = { sky: v('--sky') || '#a1e6ff', gold: v('--gold') || '#ffae41', peach: v('--peach') || '#ffc982', royal: v('--royal') || '#004aac', light: document.documentElement.dataset.theme === 'light' };
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
    if (this.state === 'thinking') return 0.55 + 0.15 * Math.sin(t * 6);
    if (this.state === 'listening') return 0.28 + 0.06 * Math.sin(t * 2.2);
    return 0.10 + 0.04 * Math.sin(t * 1.1);                   // breathing
  }

  /* fire a signal along an edge; `from` is the node it leaves */
  _fire(edgeIndex, from, gen, gold) {
    if (this.pulses.length >= MAX_PULSES) return;
    const e = this.edges[edgeIndex];
    this.pulses.push({ e: edgeIndex, from, to: e.a === from ? e.b : e.a, t: 0, v: 1.2 + hash(edgeIndex + gen * 31 + this.pulses.length) * 1.4, gen, gold });
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const ctx = this.ctx;
    const W = this.w || this.c.width, H = this.h || this.c.height;
    const R = Math.min(W, H) * 0.40;                          // sphere radius, leaves room for the label
    const cx = W / 2, cy = H * 0.47;
    const t = (now - this.t0) / 1000;
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000); this._last = now;
    const P = this._palette(now);
    const listening = this.state === 'listening', thinking = this.state === 'thinking';
    const accent = listening ? P.gold : thinking ? P.peach : P.sky;
    const faint = P.light ? 0.6 : 1;

    // activity and rotation
    const k = this.reduced ? 1 : 0.22;
    this.energy = lerp(this.energy, this._energyTarget(now), k);
    const E = this.energy;
    if (!this.reduced) {
      this.ry += dt * (0.10 + E * 0.12 + (thinking ? 0.5 : 0));
      this.rx = 0.30 + 0.10 * Math.sin(t * 0.25);
    }

    // project every node
    const cosY = Math.cos(this.ry), sinY = Math.sin(this.ry), cosX = Math.cos(this.rx), sinX = Math.sin(this.rx);
    const breathe = 1 + E * 0.04 + 0.01 * Math.sin(t * 1.3);
    for (const n of this.nodes) {
      const x1 = n.x * cosY + n.z * sinY, z1 = -n.x * sinY + n.z * cosY;
      const y2 = n.y * cosX - z1 * sinX, z2 = n.y * sinX + z1 * cosX;
      const s = 2.4 / (2.4 - z2);                              // perspective
      n.px = cx + x1 * R * s * breathe; n.py = cy + y2 * R * s * breathe;
      n.s = s; n.d = (z2 + 1) / 2;                             // 0 = far, 1 = near
      n.fire *= Math.exp(-dt * 3.2);
    }

    // spawn signals: quiet when idle, a storm when speaking or thinking
    if (!this.reduced || this.pulses.length < 6) {
      const rate = 1.2 + E * 26 + (thinking ? 10 : 0) + (listening ? 3 : 0);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        // listening: signals start at the rim and travel inward; otherwise anywhere, hubs preferred
        let from;
        if (listening) {
          from = this.nodes.reduce((best, n, i) => hash(i + Math.floor(now / 90)) > 0.5 && n.d > 0.55 && Math.hypot(n.px - cx, n.py - cy) > R * 0.7 ? i : best, Math.floor(hash(now) * this.nodes.length));
        } else {
          from = Math.floor(hash(now + this.pulses.length) * this.nodes.length);
          if (!this.nodes[from].hub && hash(now * 3) > 0.6) from = this.nodes.findIndex((n, i) => n.hub && i > from) >= 0 ? this.nodes.findIndex((n, i) => n.hub && i > from) : from;
        }
        const links = this.nodes[from].links;
        if (links.length) this._fire(links[Math.floor(hash(now * 7 + from) * links.length)], from, 0, listening);
      }
    }

    // advance signals; an arrival lights the node and may fire onward
    const keep = [];
    for (const p of this.pulses) {
      p.t += dt * p.v * (1 + E * 0.6);
      if (p.t < 1) { keep.push(p); continue; }
      const n = this.nodes[p.to];
      n.fire = 1;
      const spread = (0.30 + E * 0.45) * (p.gen < 4 ? 1 : 0);
      if (hash(p.to * 13 + Math.floor(now)) < spread) {
        const options = n.links.filter(e => e !== p.e);
        if (options.length) this._fire(options[Math.floor(hash(now + p.to) * options.length)], p.to, p.gen + 1, p.gold);
      }
    }
    this.pulses = keep;

    // ── draw ──────────────────────────────────────────────────────────
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // ambient glow behind the network
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.35);
    glow.addColorStop(0, rgba(accent, (0.14 + E * 0.14) * faint));
    glow.addColorStop(0.5, rgba(P.royal, 0.09 * faint));
    glow.addColorStop(1, rgba(P.royal, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // connections, far ones fainter; a link lights up when either end is firing
    for (const e of this.edges) {
      const a = this.nodes[e.a], b = this.nodes[e.b];
      const depth = (a.d + b.d) / 2;
      const lit = Math.max(a.fire, b.fire);
      ctx.strokeStyle = rgba(accent, (0.07 + depth * 0.16 + lit * 0.45) * faint);
      ctx.lineWidth = 0.7 + depth * 0.6 + lit * 0.6;
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }

    // signals travelling along the links, with a short trail
    for (const p of this.pulses) {
      const a = this.nodes[p.from], b = this.nodes[p.to];
      const x = lerp(a.px, b.px, p.t), y = lerp(a.py, b.py, p.t);
      const tx = lerp(a.px, b.px, Math.max(0, p.t - 0.18)), ty = lerp(a.py, b.py, Math.max(0, p.t - 0.18));
      const col = p.gold ? P.gold : accent;
      const depth = lerp(a.d, b.d, p.t);
      ctx.strokeStyle = rgba(col, 0.55 * depth + 0.2); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.55 + depth * 0.45);
      ctx.beginPath(); ctx.arc(x, y, 1.2 + depth * 1.2, 0, TAU); ctx.fill();
    }

    // nodes, far to near, firing ones bright with a halo
    const order = this.nodes.map((n, i) => i).sort((i, j) => this.nodes[i].d - this.nodes[j].d);
    for (const i of order) {
      const n = this.nodes[i];
      const base = (n.hub ? 2.6 : 1.5) * (0.6 + n.d * 0.6);
      const r = base * (1 + n.fire * 0.9);
      if (n.fire > 0.05) {
        ctx.shadowColor = rgba(accent, 0.9); ctx.shadowBlur = 14 * n.fire * faint;
      }
      ctx.fillStyle = n.fire > 0.5 ? rgba('#ffffff', 0.95) : rgba(accent, (0.35 + n.d * 0.5 + n.fire * 0.4) * faint + (P.light ? 0.2 : 0));
      ctx.beginPath(); ctx.arc(n.px, n.py, r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      if (n.hub) {                                             // hubs wear a thin halo ring
        ctx.strokeStyle = rgba(accent, 0.25 + n.d * 0.3); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(n.px, n.py, r + 2.5, 0, TAU); ctx.stroke();
      }
    }

    // listening: a soft gold pulse ring so the visitor sees they have the floor
    if (listening) {
      const q = (t % 1.6) / 1.6;
      ctx.strokeStyle = rgba(P.gold, (1 - q) * 0.5); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * (0.2 + q * 1.0), 0, TAU); ctx.stroke();
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
