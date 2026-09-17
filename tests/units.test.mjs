/* ============================================================================
   UNITS. The conversion nobody sees go wrong.

   ElevenLabs /with-timestamps answers per-CHARACTER times in SECONDS.
   TalkingHead's speakAudio() does integer-MILLISECOND arithmetic on what it is
   handed — `val.visemes.length * 150`, `Math.min(60, 2*d/3)`, `Math.min(25,
   d/2)`. Hand it seconds and nothing throws, nothing logs, and the mouth still
   moves: every viseme is simply scheduled ~1000x early and the face drifts out
   of step with the voice. It reads as "the lip-sync is a bit off", which is what
   people say about lip-sync anyway. That is why this is pinned rather than eyed.

   THE FIXTURE, and what each number is doing:

       characters   H    i    ␠    t    h    e    r    e
       starts (s)  0.0  0.1  0.2  0.3  0.4  0.5  0.6  0.7
       ends   (s)  0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.9

       ⇒ words      ['Hi', 'there']
         wtimes     [0, 300]        ms — first character's START
         wdurations [200, 600]      ms — last character's END minus that start

   300 and 600 are the load-bearing numbers: a seconds implementation returns
   0.3 and 0.6, and a per-character one never groups 'there' at all. Both are
   caught by an equality on the whole triple.

   Tested TWICE on purpose: once against src/voice.js, and once against the
   function actually inlined into dist/index.html. build.js's flatten() rewrites
   every module before it ships, so "the source is right" is not the same claim
   as "the deliverable is right".
   ========================================================================== */

import { wordsFromAlignment, pickAlignment, estimate } from '../src/voice.js';
import { launch, openPage, BUDGET } from './lib/harness.mjs';

/** The fixture, as ElevenLabs would send it. */
export const FIXTURE = {
  characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e'],
  character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
  character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9],
};

const EXPECT = { words: ['Hi', 'there'], wtimes: [0, 300], wdurations: [200, 600] };

/** Every assertion that can be made without a browser, over one implementation. */
function checkGrouper(t, where, out) {
  t.eq(out.words, EXPECT.words, `${where}: words are grouped, not characters`);
  t.eq(out.wtimes, EXPECT.wtimes, `${where}: wtimes are INTEGER MILLISECONDS`);
  t.eq(out.wdurations, EXPECT.wdurations, `${where}: wdurations are INTEGER MILLISECONDS`);

  // Said a second way, so a failure names the unit rather than a JSON diff.
  t.ok(out.wtimes[1] === 300, `${where}: the second word starts at 300 (ms), not 0.3 (s)`,
    `got ${out.wtimes[1]}`);
  t.ok(out.wtimes.every(Number.isInteger) && out.wdurations.every(Number.isInteger),
    `${where}: no fractional times reach TalkingHead's integer arithmetic`,
    `wtimes ${JSON.stringify(out.wtimes)} wdurations ${JSON.stringify(out.wdurations)}`);
  t.ok(out.words.length === out.wtimes.length && out.words.length === out.wdurations.length,
    `${where}: the three arrays are the same length`,
    `${out.words.length}/${out.wtimes.length}/${out.wdurations.length}`);
}

export async function run(t) {
  /* ── 1. the grouper, in src/ ────────────────────────────────────────── */
  checkGrouper(t, 'src/voice.js', wordsFromAlignment(FIXTURE));

  /* ── 2. the junk it must survive ────────────────────────────────────── */
  const nan = wordsFromAlignment({
    characters: ['a', ' ', 'b'],
    character_start_times_seconds: [0, 0.1, 'x'],
    character_end_times_seconds: [0.1, 0.2, 0.3],
  });
  t.eq(nan.words, ['a'], 'a word with an unparseable time is DROPPED, not emitted as NaN');
  t.ok(nan.wtimes.every(Number.isFinite), 'no NaN reaches wtimes (one poisons the whole schedule)');

  t.eq(wordsFromAlignment(null), { words: [], wtimes: [], wdurations: [] },
    'no alignment at all → three empty arrays, no throw');
  t.eq(wordsFromAlignment({ characters: ['a'] }), { words: [], wtimes: [], wdurations: [] },
    'a half-formed alignment → three empty arrays, no throw');

  const multi = wordsFromAlignment({
    characters: [...'hi  there '],
    character_start_times_seconds: [...'hi  there '].map((_, i) => i / 10),
    character_end_times_seconds: [...'hi  there '].map((_, i) => (i + 1) / 10),
  });
  t.eq(multi.words, ['hi', 'there'], 'runs of whitespace do not emit empty words');

  /* ── 3. which alignment block wins ──────────────────────────────────── */
  const normalized = { ...FIXTURE, characters: ['N', 'o', 'r', 'm'], character_start_times_seconds: [0, 1, 2, 3], character_end_times_seconds: [1, 2, 3, 4] };
  t.ok(pickAlignment({ alignment: FIXTURE, normalized_alignment: normalized }) === normalized,
    'normalized_alignment wins — it is the characters that were SPOKEN ("2025" → "twenty twenty-five")');
  t.ok(pickAlignment({ alignment: FIXTURE }) === FIXTURE,
    'alignment is the fallback when there is no normalized block');
  t.ok(pickAlignment({ normalized_alignment: { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [] }, alignment: FIXTURE }) === FIXTURE,
    'a malformed normalized block is rejected on LENGTH, not just on presence');
  t.ok(pickAlignment({}) === null, 'no usable alignment → null (the audio still plays)');

  /* ── 4. estimate(), the clock when nothing else can tell us ─────────── */
  t.ok(estimate('') === 900, 'estimate() floors at 900 ms so an empty line is still a beat',
    `${estimate('')} ms`);
  t.ok(estimate('one two three four five') === Math.round(5 / 2.55 * 1000),
    'estimate() reads at ~153 wpm', `${estimate('one two three four five')} ms for 5 words`);

  /* ── 5. THE SAME ASSERTIONS AGAINST THE SHIPPED FILE ────────────────── */
  /* build.js's flatten() rewrites every module on the way into dist/, and
     assertNoCollisions() is the only thing watching. So run the fixture through
     the function that is actually in the deliverable, in a browser, from
     file:// — where a viewer would meet it. */
  const browser = await launch();
  try {
    const { page, errors } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
    await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.canvas.attach });

    const shipped = await page.evaluate(f => {
      const out = { has: {} };
      out.has.wordsFromAlignment = typeof wordsFromAlignment === 'function';
      out.has.wordTimingsFromText = typeof wordTimingsFromText === 'function';
      out.has.pickAlignment = typeof pickAlignment === 'function';
      if (out.has.wordsFromAlignment) out.grouped = wordsFromAlignment(f);
      if (out.has.wordTimingsFromText) out.fromText = wordTimingsFromText('Hi there you', 3000);
      return out;
    }, FIXTURE);

    t.ok(shipped.has.wordsFromAlignment && shipped.has.pickAlignment,
      'dist/index.html actually contains the conversion (flatten() did not eat it)',
      JSON.stringify(shipped.has));
    if (shipped.grouped) checkGrouper(t, 'dist/index.html', shipped.grouped);

    /* The no-alignment path: ElevenLabs sometimes sends nothing usable, and Web
       Speech never sends anything. wordTimingsFromText() is what keeps the mouth
       moving then — in the SAME units, or it drifts the same way. */
    const ft = shipped.fromText;
    t.ok(ft && ft.words.length === 3, 'wordTimingsFromText() splits the line into words',
      JSON.stringify(ft?.words));
    t.ok(ft && ft.wtimes.every(Number.isInteger) && ft.wdurations.every(Number.isInteger),
      'wordTimingsFromText() also emits INTEGER MILLISECONDS',
      JSON.stringify(ft));
    t.ok(ft && ft.wtimes[0] === 0 && ft.wtimes[1] > ft.wtimes[0] && ft.wtimes[2] > ft.wtimes[1],
      'wordTimingsFromText() timings are monotonic from 0');
    t.ok(ft && Math.abs((ft.wtimes[2] + ft.wdurations[2]) - 3000) < 400,
      'wordTimingsFromText() spreads the words across the measured duration',
      `line ends at ${ft && ft.wtimes[2] + ft.wdurations[2]} ms of 3000`);

    t.eq(errors, [], 'no page errors while exercising the shipped conversion');
  } finally {
    await browser.close();
  }
}
