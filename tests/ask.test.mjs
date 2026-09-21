/* ============================================================================
   §  What Iris SAYS is always a string that was pre-rendered.

   This suite exists because of a defect that was invisible from the code and
   obvious from the data. src/app.js has exactly two speech call sites, and the
   answer one used to speak spokenForm(html) — the answer sheet's markup. That
   reads like full coverage: every answer comes from src/knowledge.js, and
   tools/prerender-voice.mjs renders spokenForm(a) for every entry in it.

   It was not. Two strings reach the voice that the generator never produces:

     · DONT_KNOW, which src/ask.js returns verbatim for any question scoring
       under CONFIDENCE_FLOOR. It is declared BESIDE the KB array, not in it,
       so KB.forEach never reached it — the deck answered what it knew in the
       real voice and everything it did not know in the robotic one.

     · the runner-up BLEND. A strong second hit is folded into the answer, so
       the spoken string was top.e.a + a paragraph of another entry. Which pair
       you get depends on the question: 39 entries make up to 1482 ordered
       pairs, so this set is combinatorial and cannot be pre-rendered at any
       price. Measured over 1400 probe questions: 105 blended answers, every
       one a cache miss.

   A miss is not a crash. src/voice.js falls through to the browser's
   speechSynthesis and the deck keeps talking, in the flat machine voice the
   pre-rendering exists to replace, with nothing anywhere reporting it. That is
   why this is a test and not a comment: the failure is inaudible to every
   other check in the repo and audible to everyone in the room.

   The fix is the `spoken` field: src/ask.js decides what is SAID, separately
   from what is SHOWN, and only ever picks strings the generator enumerates.
   §4 below is the control that proves this suite can fail.

   Pure Node — no browser. The corpus is derived the same way
   tools/prerender-voice.mjs derives it, from the sources, so this cannot drift
   out of step with the generator by hand.
   ========================================================================== */

import { SCENES } from '../src/scenes.js';
import { KB, DONT_KNOW, search, CONFIDENCE_FLOOR } from '../src/knowledge.js';
import { Ask, spokenForm } from '../src/ask.js';
import { voiceClipKey } from '../src/voice.js';

/** Every string tools/prerender-voice.mjs renders at --scope all, by key. */
function generatorCorpus() {
  const keys = new Set();
  SCENES.forEach(s => (s.lines || []).forEach(l => {
    const t = String(l || '').trim();
    if (t) keys.add(voiceClipKey(t));
  }));
  KB.forEach(e => keys.add(voiceClipKey(spokenForm(e.a).trim())));
  keys.add(voiceClipKey(spokenForm(DONT_KNOW).trim()));
  return keys;
}

/* Short questions, which is where the blend fires — a long one scores its top
   entry so far ahead that no runner-up qualifies. Every 1-, 2- and 3-word
   window over every entry's keyword bag, plus questions the deck cannot
   answer, so DONT_KNOW is exercised too. */
function probeQuestions() {
  const qs = new Set();
  for (const e of KB) {
    const w = e.k.split(/\s+/);
    for (let i = 0; i < w.length; i++) {
      qs.add(w[i]);
      if (w[i + 1]) qs.add(`${w[i]} ${w[i + 1]}`);
      if (w[i + 2]) qs.add(w.slice(i, i + 3).join(' '));
    }
  }
  for (const q of ['what is the weather in paris', 'who won the world cup',
    'tell me a joke', 'how do i cook rice', 'what is your favourite colour',
    'asdkjhaskdjh']) qs.add(q);
  return [...qs];
}

export async function run(t) {
  const corpus = generatorCorpus();
  const questions = probeQuestions();
  const ask = new Ask({});              // no key — the container's configuration
  const inCorpus = s => corpus.has(voiceClipKey(String(s || '').trim()));

  t.note(`${corpus.size} pre-rendered strings · ${questions.length} probe questions`);
  t.ok(ask.hasLLM === false,
    '§0 an Ask with no config takes the local path — the configuration the container ships');

  /* ── 1. the guarantee ─────────────────────────────────────────────────── */
  const answers = [];
  for (const q of questions) answers.push([q, await ask.answer(q)]);

  const spokenMisses = answers.filter(([, r]) => !inCorpus(r.spoken));
  t.ok(spokenMisses.length === 0,
    '§1.1 every answer speaks a string that was pre-rendered — no robotic fallback',
    spokenMisses.length
      ? `${spokenMisses.length}/${answers.length} miss, e.g. ${JSON.stringify(spokenMisses[0][0])}`
      : `${answers.length}/${answers.length} hit`);

  const noField = answers.filter(([, r]) => typeof r.spoken !== 'string' || !r.spoken.length);
  t.ok(noField.length === 0,
    '§1.2 every answer carries a non-empty `spoken` — the field is total, not a special case',
    `${answers.length - noField.length}/${answers.length}`);

  /* ── 2. and the blend is still SHOWN ──────────────────────────────────
     The fix must not be "delete the feature". The runner-up paragraph still
     reaches the answer sheet; it simply stops being spoken. */
  const blends = answers.filter(([q, r]) => {
    if (r.html === DONT_KNOW) return false;
    const top = search(q, 3)[0];
    return top && r.html !== top.e.a;
  });
  t.ok(blends.length > 0,
    '§2.1 the runner-up blend still reaches the answer SHEET (the feature is intact)',
    `${blends.length} blended answer(s) of ${answers.length}`);

  const blendSpeaksTop = blends.every(([q, r]) => r.spoken === spokenForm(search(q, 3)[0].e.a));
  t.ok(blendSpeaksTop,
    '§2.2 …and each one SPEAKS its top entry alone — shown and said are decoupled',
    `${blends.length}/${blends.length}`);

  /* ── 3. DONT_KNOW, the reply to everything off-script ─────────────────── */
  const dk = answers.filter(([, r]) => r.html === DONT_KNOW);
  t.ok(dk.length > 0, '§3.1 the probe reaches DONT_KNOW at all (positive control)',
    `${dk.length} answer(s) under CONFIDENCE_FLOOR ${CONFIDENCE_FLOOR}`);
  t.ok(inCorpus(spokenForm(DONT_KNOW)),
    '§3.2 DONT_KNOW is pre-rendered — the deck does not go robotic the moment it is asked something new');

  /* ── 4. every branch of answer(), including the one only a key reaches ──
     A field set on three paths out of four invites a caller to reach past it
     on the fourth — and the fourth here is the desk build WITH a key, the
     configuration least like the one that ships. */
  const llm = new Ask({ llm: { endpoint: 'http://127.0.0.1:1/never-called' } });
  t.ok(llm.hasLLM === true, '§4.0 an Ask with an endpoint takes the LLM path');

  // sanitise() needs a DOM, so the transport is stubbed; the RETURN SHAPE is
  // what is under test here, not the fetch.
  const viaLlm = Object.create(llm);
  viaLlm._callLLM = async () => '<p>A grounded answer, with 25% and an SLA in it.</p>';
  const rl = await viaLlm.answer('what is the intelligent airport platform');
  t.ok(rl.via === 'llm' && typeof rl.spoken === 'string' && rl.spoken.length > 0,
    '§4.1 the llm branch sets `spoken` too', `via=${rl.via}`);
  t.ok(rl.spoken === spokenForm(rl.html),
    '§4.2 …as spokenForm of its own html — model output is not pre-rendered and never claims to be',
    JSON.stringify(rl.spoken.slice(0, 60)));

  // the catch: a throwing _callLLM falls back locally, and must still be total
  const viaFallback = Object.create(llm);
  viaFallback._callLLM = async () => { throw new Error('stubbed transport failure'); };
  const rf = await viaFallback.answer('what is the intelligent airport platform');
  t.ok(rf.via === 'local-fallback' && inCorpus(rf.spoken),
    '§4.3 the local-fallback branch sets `spoken`, and it is pre-rendered',
    `via=${rf.via}`);
  const rfd = await viaFallback.answer('asdkjhaskdjh what is the weather in paris');
  t.ok(rfd.via === 'local-fallback' && inCorpus(rfd.spoken),
    '§4.4 …including its ungrounded half (DONT_KNOW)', `via=${rfd.via}`);

  /* ── 5. the control: this suite CAN fail ──────────────────────────────
     A guard nobody has watched fire is a comment. Re-derive the speech the way
     app.js used to — spokenForm(html), off the sheet's markup — and the misses
     come back. If this ever reports zero, §1.1 has stopped proving anything
     and the probe has drifted away from the questions that trip the blend. */
  const oldWay = answers.filter(([, r]) => !inCorpus(spokenForm(r.html)));
  t.ok(oldWay.length > 0,
    '§5 control: the previous spokenForm(html) speech WOULD have missed the cache',
    `${oldWay.length} of ${answers.length} would have spoken robotically`);
}
