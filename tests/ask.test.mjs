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
import { SUB_FLOOR, UNBRIEFED, GROUNDED, pin } from './lib/probes.mjs';

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

  /* Before §4 uses them: are the off-book probes still off-book? Derived by
     running the real answer(), never by comparing a score to a copied floor. */
  await pin(t, '§0.2');

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

  /* ── 4. every branch of answer(), including the ones only a key reaches ──
     A field set on three paths out of five invites a caller to reach past it on
     the others, and `via` now has four values rather than two. Each is checked.

     ── THE PROBES MOVED, AND WHY ────────────────────────────────────────────
     §4.1–§4.3 used to ask "what is the intelligent airport platform" — a
     question the briefing answers outright — and expect it to reach the model.
     That was correct while a configured key meant EVERY question went to the
     model, with retrieval supplying grounding for it to rephrase.

     The retrieval gate in src/ask.js ended that: above the confidence floor the
     briefing answers, verbatim, and no model is consulted. So the old probe now
     returns via='local' and these checks cannot pass as written — not because
     anything regressed, but because they encode an intent that was deliberately
     replaced. tests/proxy.test.mjs §2.3 measured what the old arrangement cost
     (78 proxy calls for the 39 questions retrieval already answers) and §2.4
     what it cost that no invoice shows (0/39 answers still showing the
     briefing's reviewed text). Those checks and these cannot both pass, and no
     change to src/ should be made to let them.

     The probes therefore come from tests/lib/probes.mjs, which derives each
     one's expected branch by running the real Ask.answer() rather than by
     copying a threshold — see the long note there. pin() above has already
     asserted they still land where these checks need them, so a failure below
     is about the BRANCH, never about the probe. */
  const llm = new Ask({ llm: { endpoint: 'http://127.0.0.1:1/never-called' } });
  t.ok(llm.hasLLM === true, '§4.0 an Ask with an endpoint takes the LLM path');

  // sanitise() needs a DOM, so the transport is stubbed; the RETURN SHAPE is
  // what is under test here, not the fetch.
  const viaLlm = Object.create(llm);
  viaLlm._callLLM = async () => '<p>A model answer, with 25% and an SLA in it.</p>';
  const rl = await viaLlm.answer(SUB_FLOOR);
  t.ok(rl.via === 'llm' && typeof rl.spoken === 'string' && rl.spoken.length > 0,
    '§4.1 the llm branch sets `spoken` too', `via=${rl.via}`);
  t.ok(rl.spoken === spokenForm(rl.html),
    '§4.2 …as spokenForm of its own html — model output is not pre-rendered and never claims to be',
    JSON.stringify(rl.spoken.slice(0, 60)));

  /* §4.2b the fourth value of `via`. A model answer with NOTHING behind it is a
     different thing from one drawn on related notes, and src/app.js labels them
     differently — "outside the briefing" against "related briefing notes". A
     single boolean could not separate them once the gate made `grounded`
     structurally false on every model answer, which is why the field gained a
     fourth state rather than the return gaining a fifth key. */
  const ru = await viaLlm.answer(UNBRIEFED);
  t.ok(ru.via === 'llm-unbriefed' && typeof ru.spoken === 'string' && ru.spoken.length > 0,
    '§4.2b a model answer with no grounding is distinguishable from one with some',
    `via=${ru.via}`);
  t.ok(ru.grounded === false && rl.grounded === false,
    '§4.2c …and `grounded` is false on BOTH — the gate took every true one, so it cannot discriminate',
    `llm=${rl.grounded} · llm-unbriefed=${ru.grounded}`);

  /* ── §4.3 re-cut, not deleted ────────────────────────────────────────────
     What stood here asserted that a transport failure on a GROUNDED question
     falls back to that question's own entry, pre-rendered. There is no such
     branch any more, and there cannot be: the gate answers every grounded
     question before a call is attempted, so a transport failure can only ever
     concern one the briefing does not cover. src/ask.js's catch has a single
     arm now for exactly that reason.

     Deleting it would have left no trace that the case was considered, and the
     property that REPLACED it is worth more than the one it replaced: a broken
     proxy must be undetectable on the 39 questions that matter. So it is
     re-cut to assert that, with the transport failing on every call. */
  const viaFallback = Object.create(llm);
  let attempts = 0;
  viaFallback._callLLM = async () => {
    attempts++; throw new Error('stubbed transport failure');
  };
  const rg = await viaFallback.answer(GROUNDED);
  t.ok(rg.via === 'local' && attempts === 0 && inCorpus(rg.spoken),
    '§4.3 a dead transport is invisible to a grounded question — the gate answers it without ever calling',
    `via=${rg.via} · ${attempts} call(s) attempted`);

  const rfd = await viaFallback.answer(UNBRIEFED);
  t.ok(rfd.via === 'local-fallback' && inCorpus(rfd.spoken) && attempts === 1,
    '§4.4 …while an off-book question DOES call, fails, and still speaks a pre-rendered string',
    `via=${rfd.via} · ${attempts} call(s) attempted`);

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
