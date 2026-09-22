/* ============================================================================
   Answering.

   Two paths, one interface:

     • No LLM key  → retrieval over the knowledge base. Honest, offline, and
       it either answers from a source or says it does not know.

     • LLM key set → the same retrieval runs first, and the top entries are
       handed to the model as grounding. The model may only answer from that
       grounding. This is the important part: adding a key makes AIRIS more
       fluent, not more imaginative. The facts come from the same place either
       way, which is why the deck behaves identically in a room with no network.

   Providers: OpenAI (Chat Completions) and Anthropic (Messages). The provider
   is read from config.llm.provider, or guessed from the endpoint / key shape.
   Point `endpoint` at your own proxy if you would rather the key never
   reached the browser — which, for anything customer-facing, you would.

   Every answer also returns a `visual`: an icon, a handful of figures, the
   sources they came from and two related questions — so the answer sheet can
   show something worth looking at, not just a paragraph.
   ========================================================================== */

import { search, isGrounded, CONFIDENCE_FLOOR, DONT_KNOW, WINKS } from './knowledge.js';

const SYSTEM = `You are AIRIS, the friendly presenter for "Airport in a Box" — the airport intelligence PLATFORM
built by MindGraph with DXC. You are speaking out loud to a visitor at a conference stand.

HARD RULES — never break these
- Answer ONLY from the GROUNDING provided. It is everything you know. If it does not cover the question,
  reply with the single word NOINFO first, then one warm sentence saying you don't have that and
  suggesting they ask the MindGraph and DXC team on the stand. Never invent a fact, a figure, a
  customer name, a date or a price.
- Never quote a price or a licence cost. Pricing goes to the account team.
- Any ROI, saving or percentage is an INDICATIVE industry range validated per airport at baseline —
  say so in a few words whenever you use one. Never present one as a guarantee.
- It is a platform, not a fixed list of modules. Adding a domain is metadata, not code. Never imply a
  ceiling on what can be built.
- Do not name a client airport or airline unless the grounding itself names it.

STYLE — this is spoken aloud, so keep it light
- SHORT. Hard limit 60 words. Two or three short sentences. Lead with the answer, then one reason. Stop there —
  do not summarise, do not add a closing line. Fewer words is always better.
- Warm, sweet and upbeat — a friendly guide who genuinely loves airports. One light, gentle touch of
  humour is welcome when it fits naturally; never at the expense of the visitor, an airport, or safety.
- Plain words. No jargon unless the visitor used it first. No emoji. No exclamation marks in a row.
- Plain HTML only: <p>, <b>, <ul>, <li>. At most one list with at most three items. No headings, no markdown.`;

const VENDOR_HOSTS = /api\.(openai|anthropic)\.com/;

const DEFAULT_ENDPOINT = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

/** Accept either a full route or an SDK-style base URL (…/openai/v1, …/v1). */
function resolveEndpoint(l, provider) {
  let url = String(l.endpoint || DEFAULT_ENDPOINT[provider]).replace(/\/+$/, '');
  // Complete only a bare origin or an SDK-style base (…/v1, …/openai/v1). Anything with its own
  // path — a proxy route, a Responses-API route — is used exactly as configured.
  const origin = /^https?:\/\/[^/]+$/.test(url);
  const base = /\/(openai\/)?v1$/.test(url);
  if (provider === 'openai' && (origin || base)) url += origin ? '/v1/chat/completions' : '/chat/completions';
  if (provider === 'anthropic' && (origin || base)) url += origin ? '/v1/messages' : '/messages';
  // Azure's classic surface wants ?api-version=…; its v1 surface rejects it. Only sent when configured.
  if (l.apiVersion) url += (url.includes('?') ? '&' : '?') + 'api-version=' + encodeURIComponent(l.apiVersion);
  return url;
}

/** gpt-5 / o-series models take a reasoning budget; keep it out of a 70-word spoken answer. */
const REASONING_MODEL = /^(gpt-5|o\d)/i;

export class Ask {
  constructor(config = {}) { this.cfg = config; }

  /** A key, or an endpoint that is not one of the vendor defaults (i.e. a proxy). */
  get hasLLM() {
    const l = this.cfg?.llm || {};
    return Boolean(l.apiKey) || Boolean(l.endpoint && !VENDOR_HOSTS.test(l.endpoint));
  }

  get provider() {
    const l = this.cfg?.llm || {};
    if (l.provider) return String(l.provider).toLowerCase();
    if (/anthropic\.com/.test(l.endpoint || '') || /^sk-ant-/.test(l.apiKey || '')) return 'anthropic';
    return 'openai';
  }

  /**
   * @returns {Promise<{html:string, scene:string|null, grounded:boolean, via:string, visual:object}>}
   */
  async answer(question) {
    const hits = search(question, 4);
    const top = hits[0];
    const grounded = isGrounded(top);
    const scene = grounded ? top.e.scene : null;
    const visual = visualFor(hits, grounded);

    // Nothing in the briefing covers it: say so, locally, without a network round-trip.
    // Handing an LLM loosely related grounding is how a confident wrong answer gets made.
    if (!grounded) return { html: DONT_KNOW, scene: null, grounded: false, via: 'local', visual };

    if (!this.hasLLM) return { html: withWink(top.e.a), scene, grounded: true, via: 'local', visual };

    const grounding = hits
      .filter(h => h.score >= CONFIDENCE_FLOOR * 0.6)
      .map(h => `--- ${h.e.id} ---\n${textOf(h.e.a)}${factsText(h.e)}`)
      .join('\n\n');

    try {
      const { html, noinfo } = await this._callLLM(question, grounding);
      if (noinfo) return { html, scene: null, grounded: false, via: 'llm', visual: visualFor(hits, false) };
      return { html, scene, grounded: true, via: 'llm', visual };
    } catch (err) {
      console.warn('[ask] LLM failed, answering locally:', err?.message || err);
      return { html: withWink(top.e.a), scene, grounded: true, via: 'local-fallback', visual };
    }
  }

  async _callLLM(question, grounding) {
    const l = this.cfg.llm || {};
    const provider = this.provider;
    const endpoint = resolveEndpoint(l, provider);
    const maxTokens = l.maxTokens || 260;
    const user = `GROUNDING\n${grounding}\n\nQUESTION\n${question}`;
    const headers = { 'Content-Type': 'application/json', ...(l.headers || {}) };
    let body;

    if (provider === 'anthropic') {
      if (l.apiKey) {
        headers['x-api-key'] = l.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        // Only needed when the key is used directly from a browser, which you
        // should avoid outside a demo — put a proxy at `endpoint` instead.
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }
      body = {
        model: l.model || 'claude-sonnet-5',
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      };
    } else {
      if (l.apiKey) {
        headers['Authorization'] = `Bearer ${l.apiKey}`;   // OpenAI, and Azure's v1 surface
        headers['api-key'] = l.apiKey;                     // Azure's classic surface; ignored elsewhere
      }
      const model = l.model || 'gpt-4o-mini';
      body = {
        model,
        // max_completion_tokens is accepted by every current OpenAI chat model;
        // max_tokens is rejected by the newer reasoning families.
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      };
      const effort = l.reasoningEffort || (REASONING_MODEL.test(model) ? 'minimal' : '');
      if (effort) body.reasoning_effort = effort;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), l.timeoutMs || 12000);
    let res;
    try {
      res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    let text = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')          // Anthropic
      : (data.choices?.[0]?.message?.content                                              // OpenAI chat
        || data.output_text                                                               // OpenAI responses / proxies
        || (Array.isArray(data.output) ? data.output.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n') : '')
        || '');
    // The model flags "not in the grounding" with a leading NOINFO; a plain-English refusal at the
    // start of the reply counts too. Either way the answer sheet shows no figures for it.
    const noinfo = /^\s*(?:<p>\s*)?(?:NOINFO\b|I (?:don.t|do not) have that|That (?:isn.t|is not) in what)/i.test(text);
    text = text.replace(/^\s*(?:<p>\s*)?NOINFO[:.\s]*/i, m => /<p>/.test(m) ? '<p>' : '');
    return { html: sanitise(text), noinfo };
  }
}

/* ── the visual side of an answer ─────────────────────────────────────── */

/** Icon, figures, sources and related questions drawn from the retrieval hits. */
function visualFor(hits, grounded) {
  // No figures on a don't-know: a number beside "I don't have that" would be a lie by decoration.
  const good = grounded ? hits.filter(h => h.score >= CONFIDENCE_FLOOR * 0.6) : [];
  const lead = grounded ? hits[0].e : null;
  const facts = [];
  for (const h of good) {
    for (const f of (h.e.facts || [])) {
      if (facts.length >= 4) break;
      if (!facts.some(x => x.l === f.l)) facts.push(f);
    }
  }
  const sources = [...new Set(good.map(h => h.e.src).filter(Boolean))].slice(0, 3);
  const related = good
    .filter(h => !lead || h.e.id !== lead.id)
    .map(h => h.e.q)
    .filter(Boolean)
    .slice(0, 2);
  return {
    icon: lead?.icon || (grounded ? '✈️' : '🤔'),
    facts,
    sources,
    related,
  };
}

/** The figures, as text, so an LLM can quote them accurately. */
function factsText(e) {
  if (!e.facts?.length) return '';
  return '\nFIGURES: ' + e.facts.map(f => `${f.n} ${f.l}`).join(' · ');
}

/** A short, gentle sign-off on some local answers. Never on a don't-know. */
function withWink(html) {
  if (!WINKS.length || Math.random() > 0.45) return html;
  const w = WINKS[Math.floor(Math.random() * WINKS.length)];
  return `${html}<p class="wink">${w}</p>`;
}

/* ── helpers ──────────────────────────────────────────────────────────── */

const textOf = html => String(html)
  .replace(/<li>/g, '\n- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ')
  .trim();

/** Keep only the tags we render. Anything else becomes text. */
function sanitise(input) {
  let s = String(input || '').trim();
  if (!s) return DONT_KNOW;
  // if the model returned markdown despite instructions, cope
  s = s.replace(/```[a-z]*\n?|```/g, '')
       .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
       .replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>');
  if (/<li>/.test(s) && !/<ul>|<ol>/.test(s)) s = s.replace(/((?:<li>.*?<\/li>\s*)+)/gs, m => `<ul>${m}</ul>`);
  const div = document.createElement('div');
  div.innerHTML = s;
  const ALLOWED = new Set(['P', 'B', 'STRONG', 'EM', 'I', 'UL', 'OL', 'LI', 'BR']);
  const walk = node => {
    [...node.children].forEach(child => {
      walk(child);
      if (!ALLOWED.has(child.tagName)) child.replaceWith(...child.childNodes);
      else [...child.attributes].forEach(a => child.removeAttribute(a.name));
    });
  };
  walk(div);
  const out = div.innerHTML.trim();
  return /<p|<ul|<ol/.test(out) ? out : `<p>${out}</p>`;
}

/** Plain text for the voice — the answer sheet shows HTML, AIRIS speaks this. */
export function spokenForm(html) {
  return textOf(html).replace(/\s*-\s+/g, '. ').replace(/\.\.+/g, '.').slice(0, 900);
}
