/* ============================================================================
   Answering.

   Two paths, one interface:

     • No LLM key  → retrieval over the knowledge base. Honest, offline, and
       it either answers from a source or says it does not know.

     • LLM key set → the same retrieval runs first, and the top entries are
       handed to the model as grounding. The model may only answer from that
       grounding. This is the important part: adding a key makes Iris more
       fluent, not more imaginative. The facts come from the same place either
       way, which is why the deck behaves identically in a room with no network.

   The default adapter targets the Anthropic Messages API. Point `endpoint` at
   your own proxy if you would rather the key never reached the browser — which,
   for anything customer-facing, you would.
   ========================================================================== */

import { search, CONFIDENCE_FLOOR, DONT_KNOW } from './knowledge.js';

const SYSTEM = `You are Iris, the presenter for Intelligent Airport — an airport PLATFORM built by
MindGraph with DXC. You are speaking aloud to an airport executive during a live walkthrough.

THE NAME
- The product is "Intelligent Airport". Two words, both capitalised, and no article in front of it:
  "Intelligent Airport reads every source system", never "the intelligent airport" or "an intelligent
  airport". Lowercase it, or put "the" or "an" in front, and it stops being a name — it reads as a
  vague compliment about airports in general, which is the opposite of naming a product.
- Name it once, then say "it" or "the platform". A name repeated in every sentence sounds like a
  brochure being read out.
- It has exactly one name and you have it. If some older name for this product surfaces in your own
  memory, it is retired — using it dates the whole conversation. The GROUNDING is current; you are not.
- Three names in this material sound alike and are NOT interchangeable:
    Intelligent Airport — the product. What is being bought and delivered. This is what you speak for.
    Thinking Airport    — DXC's wider vision, which the product demonstrates. A framework, not a
                          purchasable thing.
    AIRIS               — the AI Real-Time Integrated System named in the source briefing, and where
                          Iris's own name comes from. An engine, not the product.
  Never merge two of them into one phrase. If a question is ambiguous between them, answer about the
  product and say that is the one you are describing.

HARD RULES
- Answer ONLY from the GROUNDING provided. It is the complete set of facts you have.
- If the grounding does not cover the question, say plainly that you do not have it and suggest they
  put it to the MindGraph and DXC team. Never invent a figure, a customer name, a date or a price.
- Never quote a price. Direct pricing questions to the account team.
- Any ROI or percentage is an INDICATIVE INDUSTRY RANGE validated per airport at baseline — say so
  whenever you use one. Never present one as a guarantee.
- It is a platform, not a fixed list of modules. Adding a domain is metadata, not code. Do not imply
  a ceiling on what can be built.

VOICE
- Calm, senior, specific. Short sentences. No marketing adjectives, no exclamation marks, no emoji.
- Lead with the answer, then the reason. Two or three short paragraphs at most — this is being spoken.
- Concede what is genuinely uncertain. A frank limit is more persuasive than a claim.
- Plain HTML only: <p>, <b>, <ul>, <li>. No markdown, no headings.`;

export class Ask {
  constructor(config = {}) { this.cfg = config; }

  get hasLLM() { return Boolean(this.cfg?.llm?.apiKey || this.cfg?.llm?.endpoint); }

  /**
   * @returns {Promise<{html:string, scene:string|null, grounded:boolean, via:string}>}
   */
  async answer(question) {
    const hits = search(question, 3);
    const top = hits[0];
    const grounded = Boolean(top && top.score >= CONFIDENCE_FLOOR);
    const scene = grounded ? top.e.scene : null;

    if (!this.hasLLM) {
      if (!grounded) return { html: DONT_KNOW, scene: null, grounded: false, via: 'local' };
      // Blend in a strong runner-up so related questions get a fuller answer.
      const second = hits[1];
      const extra = second && second.score >= top.score * 0.72 && second.e.id !== top.e.id
        ? `<p style="opacity:.85">${stripP(second.e.a).split('</p>')[0]}</p>` : '';
      return { html: top.e.a + extra, scene, grounded: true, via: 'local' };
    }

    const grounding = hits
      .filter(h => h.score >= CONFIDENCE_FLOOR * 0.6)
      .map(h => `--- ${h.e.id} ---\n${textOf(h.e.a)}`)
      .join('\n\n');

    try {
      const html = await this._callLLM(question, grounding || '(nothing relevant found)');
      return { html, scene, grounded, via: 'llm' };
    } catch (err) {
      console.warn('[ask] LLM failed, answering locally:', err?.message || err);
      return grounded
        ? { html: top.e.a, scene, grounded: true, via: 'local-fallback' }
        : { html: DONT_KNOW, scene: null, grounded: false, via: 'local-fallback' };
    }
  }

  async _callLLM(question, grounding) {
    const {
      endpoint = 'https://api.anthropic.com/v1/messages',
      apiKey,
      model = 'claude-sonnet-5',
      maxTokens = 700,
      headers: extraHeaders = {},
    } = this.cfg.llm;

    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      // Only needed when the key is used directly from a browser, which you
      // should avoid outside a demo — put a proxy at `endpoint` instead.
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `GROUNDING\n${grounding}\n\nQUESTION\n${question}`,
        }],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    const text = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      : (data.output_text || data.choices?.[0]?.message?.content || '');
    return sanitise(text);
  }
}

/* ── helpers ──────────────────────────────────────────────────────────── */

const textOf = html => String(html)
  .replace(/<li>/g, '\n- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ')
  .trim();

const stripP = html => String(html).trim();

/** Keep only the tags we render. Anything else becomes text. */
function sanitise(input) {
  let s = String(input || '').trim();
  if (!s) return DONT_KNOW;
  // if the model returned markdown despite instructions, cope
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
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

/** Plain text for the voice — the answer sheet shows HTML, Iris speaks this. */
export function spokenForm(html) {
  return textOf(html).replace(/\s*-\s+/g, '. ').replace(/\.\.+/g, '.').slice(0, 1200);
}
