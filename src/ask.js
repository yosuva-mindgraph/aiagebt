/* ============================================================================
   Answering.

   RETRIEVAL DECIDES FIRST, ALWAYS. One question, two possible destinations, and
   which one it takes is settled by the knowledge base before any model is
   consulted:

     • ABOVE the confidence floor → the briefing answers, from its own reviewed
       text, verbatim. No network, no model, nothing to pay for, and the same
       words every time. This is the path all 39 knowledge-base questions take,
       on every build, whether or not an LLM is configured.

     • BELOW it → nothing curated covers the question. With an LLM configured it
       goes to the model, grounded in whatever partial matches retrieval found;
       without one, Iris says plainly that she does not have it.

   So an LLM does not make the deck's answers more fluent — it makes the deck
   answer MORE QUESTIONS. Beyond the 39, not instead of them. See the long note
   on the gate in answer(): this deliberately replaced an earlier arrangement
   that let a model rephrase grounded answers, and the reasons matter.

   The default adapter targets the Anthropic Messages API. Point `endpoint` at
   your own proxy if you would rather the key never reached the browser — which,
   for anything customer-facing, you would.

   ── the proxy contract ──────────────────────────────────────────────────────
   With `endpoint` set and `apiKey` BLANK this posts a narrow body and no auth
   header at all:

       POST <endpoint>   { question, grounding, grounded }
       →  the vendor's response body, unchanged

   `endpoint` is expected to be RELATIVE ('/api/llm'). Same origin needs no CORS
   and no preflight, and — the reason it is relative rather than short — nothing
   bakes the hostname into the build, so the deck survives being moved or being
   served from an ephemeral tunnel address that changes every restart.

   The response is read exactly as the direct call's is, so a proxy that passes
   the vendor's JSON through needs no client change; see _callLLM.
   ========================================================================== */

import { search, CONFIDENCE_FLOOR, DONT_KNOW } from './knowledge.js';

/** How long an open-ended answer may take before the local one takes over.
    Reasoned about at the call site in _callLLM(); override per deployment with
    `llm.timeoutMs`. */
export const LLM_TIMEOUT_MS = 15000;

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

  /* ── html vs spoken: why an answer carries two forms ──────────────────
     `html` is what the answer sheet SHOWS. `spoken` is what Iris SAYS. They
     are usually the same words and deliberately are not always, because they
     are addressed differently: the sheet is read, and the voice is looked up
     in a table of clips rendered ahead of time.

     A pre-rendered clip is addressed by the EXACT text it speaks
     (voiceClipKey in src/voice.js). So any spoken string the generator did
     not produce is a cache miss, and a miss falls through to the browser's
     speechSynthesis — the flat robotic voice the pre-rendering exists to get
     rid of. Whatever goes in `spoken` therefore has to be a string
     tools/prerender-voice.mjs can enumerate offline.

     That is exactly what the runner-up blend below is not. It concatenates
     the top entry with a paragraph of the SECOND, and which pair you get
     depends on the question — 39 entries make up to 1482 ordered pairs, so
     the set of speakable strings is combinatorial and cannot be enumerated
     at any cost worth paying. Measured before this existed: of 1400 probe
     questions, 105 produced a blended answer and every one of them missed
     the cache and spoke robotically.

     So the blend stays on SCREEN and stops being spoken. The viewer reads
     the runner-up paragraph and hears a tight single answer, which is also
     the better outcome out loud — two entries concatenated ran to 818
     characters of run-on in the worst measured case.

     `spoken` is set on EVERY branch, including the LLM one where nothing is
     pre-rendered anyway. A field that is present on three paths out of four
     invites a caller to reach past it "just this once" on the fourth, and
     the fourth here is the desk build with a key — the configuration least
     like the one that ships. Total field, one shape of path.

     ── `via`, the provenance discriminator ───────────────────────────────
     Four values, because the answer sheet has four honest things to say and
     src/app.js has no other way to tell them apart. It is the only field that
     carries provenance, so it carries all of it rather than half of it plus a
     new key — the key SET of this return is pinned by tests/guards.test.mjs on
     purpose, so that an addition has to be argued for.

       'local'          retrieval answered, from the briefing's own text
                        (also the DONT_KNOW reply, when there is no model)
       'llm'            the model answered, drawing on partial matches that
                        fell under the floor
       'llm-unbriefed'  the model answered with nothing relevant to draw on
       'local-fallback' the model was meant to answer and the transport failed

     @returns {Promise<{html:string, spoken:string, scene:string|null,
     grounded:boolean, via:'local'|'llm'|'llm-unbriefed'|'local-fallback'}>} */
  async answer(question) {
    const hits = search(question, 3);
    const top = hits[0];
    const grounded = Boolean(top && top.score >= CONFIDENCE_FLOOR);
    const scene = grounded ? top.e.scene : null;

    /* ── THE GATE: retrieval decides, and it decides FIRST ──────────────────
       Above the confidence floor, the briefing answers. Not "the briefing is
       handed to a model which then answers" — the briefing's own reviewed
       sentences, verbatim, as they reach the screen on a build with no network
       at all. The model is for what comes AFTER the 39 facts, not instead of
       them.

       ── this deliberately overrides an older intent, so do not restore it ──
       The original design ran this branch only when no key was configured, and
       let the model rephrase a grounded answer for fluency — "a key makes Iris
       more fluent, not more imaginative". That trade was reasonable for a desk
       build. It is wrong for this one, in two ways that only appeared once the
       deck was deployed public with a proxy that is always reachable:

         • What it costs. `hasLLM` is true whenever an endpoint is set, and
           config.public.js sets one, so EVERY question took the model path —
           measured at 78 proxy calls (39 × /api/llm, 39 × /api/tts) for the 39
           questions the knowledge base answers outright. Required: zero. The
           deck was cheaper with a broken proxy than a working one.

         • What it costs that no invoice shows, and this is the real reason.
           src/knowledge.js is 39 hand-written answers carrying rules the room
           depends on: never quote a price, every percentage is an INDICATIVE
           industry range validated per airport at baseline, it is a platform
           and not a fixed list of modules. Those hold only because the text is
           fixed. A paraphrase drops one silently and nothing on screen says so.
           In front of an airport CFO or a regulator, an answer that always says
           the same reviewed thing is worth far more than a fluent one.

       So `grounded` is computed and then used ONLY as a gate — which is the
       thing a reader notices and wonders about, hence this note. It is not also
       handed to the model for polish, on purpose: polish is what would lose the
       sentence that was polished away. */
    if (grounded) {
      // Blend in a strong runner-up so related questions get a fuller answer.
      const second = hits[1];
      const extra = second && second.score >= top.score * 0.72 && second.e.id !== top.e.id
        ? `<p style="opacity:.85">${stripP(second.e.a).split('</p>')[0]}</p>` : '';
      /* The blend is shown, not said. spokenForm(top.e.a) is precisely the
         string the generator renders for this entry, so it is always a hit. */
      return {
        html: top.e.a + extra, spoken: spokenForm(top.e.a),
        scene, grounded: true, via: 'local',
      };
    }

    /* Below the floor: nothing curated covers this, so there is nothing to
       protect and the model is pure gain. With no endpoint and no key there is
       no model either, and saying so is the honest end of it. */
    if (!this.hasLLM) {
      return {
        html: DONT_KNOW, spoken: spokenForm(DONT_KNOW),
        scene: null, grounded: false, via: 'local',
      };
    }

    /* Partial grounding still travels. A question under the floor may still sit
       near two or three entries, and the proxy's system prompt is built to use
       them for the product tier and to decline when they do not cover it — so
       withholding them would make the answer worse, not safer. Whether any
       survived the filter is what separates "drew on related notes" from "had
       nothing to draw on", which the answer sheet then labels differently. */
    const grounding = hits
      .filter(h => h.score >= CONFIDENCE_FLOOR * 0.6)
      .map(h => `--- ${h.e.id} ---\n${textOf(h.e.a)}`)
      .join('\n\n');

    try {
      /* `grounded` is false on every call that reaches here — the gate above
         took every true one — and it is still sent because the proxy's wire
         contract is {question, grounding, grounded} and the value is honest.
         It tells the proxy "retrieval found nothing above the floor", which is
         exactly the state its prompt should answer in. */
      const html = await this._callLLM(question, grounding || '(nothing relevant found)', grounded);
      /* Model-generated: unknowable ahead of time, so nothing is pre-rendered
         for it and this speaks through the live TTS path or Web Speech. This is
         now the ONLY thing that costs a round trip, which is the whole point:
         it is text that did not exist until someone asked for it. `scene` is
         null and `grounded` false structurally, not incidentally. */
      return {
        html, spoken: spokenForm(html),
        scene, grounded, via: grounding ? 'llm' : 'llm-unbriefed',
      };
    } catch (err) {
      console.warn('[ask] LLM failed, answering locally:', err?.message || err);
      /* No grounded arm here any more: the gate already answered every question
         the briefing covers, so a transport failure can only ever concern one
         it does not. DONT_KNOW is the right answer to those with or without a
         proxy, which is why an outage costs the open-ended answers and nothing
         else. */
      return {
        html: DONT_KNOW, spoken: spokenForm(DONT_KNOW),
        scene: null, grounded: false, via: 'local-fallback',
      };
    }
  }

  async _callLLM(question, grounding, grounded = false) {
    const {
      endpoint = 'https://api.anthropic.com/v1/messages',
      apiKey,
      model = 'claude-sonnet-5',
      maxTokens = 700,
      timeoutMs = LLM_TIMEOUT_MS,
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

    /* ── two request shapes, one for each side of the key ─────────────────
       WITH a key the browser is the API client, so it sends the vendor's own
       Messages shape — system prompt, model, token cap and all.

       WITHOUT one, `endpoint` is a proxy that holds the key server-side, and
       the browser is no longer trusted with any of those fields: a page anyone
       can open would otherwise be free to swap SYSTEM for something else, or
       ask for a model and a token cap the operator is paying for. So the
       keyless body is narrow on purpose — the question, its grounding, and
       whether the grounding actually covered it — and the proxy composes
       `system`, `model` and `max_tokens` itself, discarding whatever a client
       sent. Anything the proxy would throw away is not worth sending. */
    const body = apiKey
      ? {
        model,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `GROUNDING\n${grounding}\n\nQUESTION\n${question}`,
        }],
      }
      : { question, grounding, grounded };

    /* ── the deadline ───────────────────────────────────────────────────
       A refused connection rejects at once; a proxy that ACCEPTS and then
       hangs — a tunnel still up in front of a wedged backend, which is the
       failure this deployment actually has — never rejects at all. Without a
       deadline the Ask box sits on "Looking that up…" for the rest of the
       meeting with a perfectly good local answer one catch block away. The
       abort lands in answer()'s catch like any other transport failure, so
       the timeout costs one wait and then degrades exactly as an outage does.

       15 s, and not less: the round trip is a real non-streaming completion —
       time to first token, then a couple of spoken paragraphs generated at
       tens of tokens a second — so several seconds is SUCCESS, not a stall,
       and a tighter deadline would spend the model's money and then throw the
       answer away. Not more, either: this is dead air in front of a room, and
       past about fifteen seconds the presenter has already moved on. */
    const controller = new AbortController();
    const timer = setTimeout(() => { try { controller.abort(); } catch {} }, timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);

      const data = await res.json();
      const text = Array.isArray(data.content)
        ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        : (data.output_text || data.choices?.[0]?.message?.content || '');
      return sanitise(text);
    } catch (err) {
      // Name the deadline rather than letting an opaque AbortError reach the
      // console — "LLM failed" with no reason is what makes this hard to read
      // from the back of a room. The body read is inside the try on purpose:
      // headers-then-hang aborts here too, not only a hang before the reply.
      if (err?.name === 'AbortError') throw new Error(`LLM timed out after ${timeoutMs} ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
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

/* ── what a synthesiser mangles, and where it is safe to fix it ───────────
   Every engine reads symbols, ranges and some letter-acronyms badly — the
   browser's own speechSynthesis worst of all, and that is the one running
   whenever no ElevenLabs key is configured. So the SPOKEN form of an answer
   is normalised here.

   Why HERE and not in src/voice.js. The scene narration in src/scenes.js is
   captioned and spoken from the SAME string, and src/app.js lights the
   caption up word by word by walking its spans BY INDEX against the spoken
   word timings — so a normaliser that changed the word count on the way to
   the voice would silently desynchronise the highlight. An answer has no
   such problem: app.js captions the answer's `spoken` field and then speaks
   that same field, so caption and speech are the same tokens either way, and
   only the rich answer SHEET keeps the tight typographic form. (They are one
   string on purpose. Captioning the sheet's HTML instead would put the
   runner-up paragraph on screen as a caption while the voice never said it.)
   This file is already the display/speech seam; expanding anywhere
   downstream of it would not be.

   Numbers stay as digits on purpose — every engine reads 72 as seventy-two.
   It is the symbols AROUND them (plus-minus, tilde, percent, a dash used as
   a range, a trailing plus) that come out as silence or as nonsense.      */
const SPOKEN = [
  /* symbols and ranges */
  [/±\s*/g, 'plus or minus '],
  /* "a ~3 minute hold" must not become "a around 3 minute hold" — the tilde
     stands where the article's own hedge goes, so it eats the article. */
  [/\b(?:a|an)\s+~\s*(?=\d)/g, 'around '],
  [/~\s*(?=\d)/g, 'around '],
  [/(\d)\s*%/g, '$1 percent'],
  [/(\d)\s*\+/g, '$1 or more'],
  [/(\d)\s*[–—-]\s*(?=\d)/g, '$1 to '],          // a 6-8 range -> 6 to 8
  [/\b([23])D\b/g, '$1-D'],                      // 2D / 3D, not "twod"
  [/\s*&\s*/g, ' and '],                         // also turns P&L into P and L
  [/\s*→\s*/g, ', then '],                       // tariff -> gross charges -> ...
  [/\s*·\s*/g, '. '],                            // the separator in a long list
  [/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, '$1 or $2'],
  /* a parenthetical is read as one breathless run; commas give it joints */
  [/\s*\(\s*/g, ', '],
  [/\s*\)/g, ','],

  /* ── acronyms ──────────────────────────────────────────────────────────
     Judged one at a time, NOT spelled out wholesale. The audience is airport
     executives: reading AVSEC or ICAO out in full every time would be
     condescending and would pad the runtime. The rule is narrower than that.

     An acronym whose letters do NOT form a sayable syllable (ESG, KPI, DXC,
     CMMS, PRM, BMS, ETL, LLM, CCTV) is already spelled out correctly by every
     engine, and is left alone. One that is MEANT to be said as a word (ICAO,
     IGOM, AVSEC, SCADA, FIDS, CUSS, SIEM, AIRIS) is also left alone, because
     saying it as a word is the correct reading. What is fixed is the middle
     case: letters that happen to form a word or a plausible syllable, so the
     engine says the wrong thing out loud — "IT" as "it", "SOC" as "sock",
     "ASQ" as "ask", "ROI" as "roy", "SLA" as "slah". Those get hyphens,
     which is the one cue every engine reads as "spell this".              */
  [/\bAOCC\b/g, 'A-O-C-C'], [/\bNOC\b/g, 'N-O-C'], [/\bSOC\b/g, 'S-O-C'],
  [/\bEOC\b/g, 'E-O-C'], [/\bIT\b/g, 'I-T'], [/\bOT\b/g, 'O-T'],
  [/\bSLAs\b/g, 'service-level agreements'], [/\bSLA\b/g, 'S-L-A'],
  [/\bROI\b/g, 'R-O-I'], [/\bASQ\b/g, 'A-S-Q'], [/\bPOS\b/g, 'P-O-S'],
  [/\bAPIs\b/g, 'application programming interfaces'], [/\bAPI\b/g, 'A-P-I'],
  [/\bACI\b/g, 'A-C-I'], [/\bGRI\b/g, 'G-R-I'], [/\bFAA\b/g, 'F-A-A'],
  [/\bCX\b/g, 'C-X'], [/\bUX\b/g, 'U-X'],

  /* tidy up after the parentheses and the list separators, so nothing is
     read as a stutter of punctuation */
  [/\s+([,.;:])/g, '$1'],
  [/,\s*([,.;:])/g, '$1'],
  [/\.\s*,/g, '.'],
  /* a colon introducing a list whose first item then became its own sentence
     leaves "modelled:." — one stop, not two marks of punctuation. */
  [/[,;:]+\./g, '.'],
  [/\s{2,}/g, ' '],
];

/** Plain text for the voice — the answer sheet shows HTML, Iris speaks this. */
export function spokenForm(html) {
  let s = textOf(html).replace(/\s*-\s+/g, '. ').replace(/\.\.+/g, '.');
  for (const [re, to] of SPOKEN) s = s.replace(re, to);
  return s.trim().slice(0, 1200);
}
